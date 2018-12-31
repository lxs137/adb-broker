import { EventEmitter } from "events";
import { Socket } from "net";
import { CommandHelper } from "commandHelper";
import { Packet, PacketCommand } from "adbd/packet";
import { AdbServerConnection } from "adb-server/adbServerConn";
import { ResponseCode } from "commands";
import { encode } from "adb-server/encoder";
import { CommandReplyStream } from "adb-server/commandReply";
const logger = require("log4js").getLogger("commandHandler");

/** 
 * This class will handle "OPEN" "READY" "WRITE" "CLOSE" msg
 */
export class CommandHandler extends EventEmitter {
  private deviceID: string;
  private localID: number;
  private remoteID: number;
  private maxPayload: number;
  private isOpen: boolean = false;
  private isClose: boolean = false;
  // connection to remote adb client
  private remoteConn: Socket;
  // connection to local adb server
  private localConn: AdbServerConnection;
  private localConnReader: CommandReplyStream;
  private hasAckMsg: boolean = true; 

  constructor(deviceID: string, localID: number, remoteID: number, maxPayload: number, connection: Socket) {
    super();
    this.deviceID = deviceID;
    this.localID = localID;
    this.remoteID = remoteID;
    this.maxPayload = maxPayload;
    this.remoteConn = connection;
  }

  public close() {
    if(this.localConn) {
      this.localConn.close();
      this.localConn = undefined;
    }
    if(this.isClose)
      return;
    const packet = Packet.genSendPacket(PacketCommand.A_CLSE, 
      this.isOpen ? this.localID : 0, this.remoteID, undefined);
    this.sendPacketToRemote(packet);
    this.isClose = true;
    this.emit("end");
  }

  public handle(packet: Packet) {
    if(this.isClose)
      return;
    switch(packet.command) {
      case PacketCommand.A_OPEN:
        this.handleOpenPacket(packet);
        break;
      case PacketCommand.A_OKAY:
        this.handleOkayPacket(packet);
        break;
      case PacketCommand.A_WRTE:
        this.handleWritePacket(packet);
        break;
      case PacketCommand.A_CLSE:
        this.handleClosePacket(packet);
        break;
    }
  }

  private handleOpenPacket(packet: Packet) {
    CommandHelper.transport(this.deviceID).then(
      (conn) => {
        this.localConn = conn;
        return this.transPacketToLocal(packet, true);
      }
    ).then(
      () => this.localConn.parser.readASCII(4)
    ).then(
      (localRes) => {
        if(localRes === ResponseCode.OKAY) {
          this.isOpen = true;
          this.sendPacketToRemote(Packet.genSendPacket(
            PacketCommand.A_OKAY, this.localID, this.remoteID, undefined));
          return Promise.resolve();
        } else if (localRes === ResponseCode.FAIL) {
          return this.localConn.parser.readError().then(
            (errStr) => Promise.reject(new Error(errStr))
          );
        } else {
          return Promise.reject(
            new Error("Unexpected response('OKAY' or 'FAIL'): " + localRes));
        }
      }
    ).then(
      () => {
        return new Promise((resolve, reject) => {
          this.localConnReader = this.localConn.parser.readToStream(this.maxPayload);
          this.localConnReader.on("data", (data) => {
            this.sendPacketToRemote(Packet.genSendPacket(
              PacketCommand.A_WRTE, this.localID, this.remoteID, <Buffer>data
            ));
            this.hasAckMsg = false;
            this.localConnReader.pause();
          });
          this.localConnReader.once("hasData", () => {
            this.localConnReader.forceFlush();
          });
          this.localConnReader.on("end", () => {
            // Send remain data in cache
            this.localConnReader.removeAllListeners("data");
            let remainData;
            if(remainData = this.localConnReader.getRemainData()) {
              this.sendPacketToRemote(Packet.genSendPacket(
                PacketCommand.A_WRTE, this.localID, this.remoteID, remainData
              ));
            }
            resolve();
          });
          this.localConnReader.on("error", (err) => {
            this.localConnReader.removeAllListeners("data");
            reject(err);
          });
        });
      }
    ).then(
      () => this.close()
    ).catch(
      (err: Error) => {
        this.emit("error", new Error(
          `Handle Open Packet err: ${err.message} \n ${err.stack}`
        ));
      }
    );
  }

  private handleOkayPacket(packet: Packet) {
    if(this.isClose)
      return;
    this.hasAckMsg = true;
    if(this.localConnReader) {
      this.localConnReader.resume();
    }
  }

  private handleWritePacket(packet: Packet) {
    if(this.isClose)
      return;
    this.transPacketToLocal(packet);
    this.sendPacketToRemote(Packet.genSendPacket(
      PacketCommand.A_OKAY, this.localID, this.remoteID, undefined
    ));
  }

  private handleClosePacket(packet: Packet) {
    if(this.isClose)
      return;
    this.close();
  }

  private sendPacketToRemote(packet: Packet) {
    logger.debug("Output packet: %s", packet.toString());
    this.remoteConn.write(packet.toBuffer());
  }

  private transPacketToLocal(packet: Packet, needEncode: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if(!this.localConn)
        reject(new Error("Connection to local adb server has not create"));
      this.localConn.send(
        needEncode ? encode(packet.data) : packet.data, () => {
        logger.info("Transimit packet to local: %s", packet.data);
        resolve();
      });
    });
  }
}

export class CommandHandlers {
  // identified by localID
  private handlers: { [key: string]: CommandHandler } = {};
  private _count: number = 0;

  get count(): number {
    return this._count;
  }
  /**
   * @return false if this localID has been used
   */
  public add(localID: string, handle: CommandHandler): boolean {
    if(this.handlers[localID]) {
      return false;
    }
    this.handlers[localID] = handle;
    this._count++;
    return true;
  }

  public get(localID: string): CommandHandler {
    return this.handlers[localID];
  }

  public remove(localID: string) {
    const handle = this.handlers[localID];
    if(handle) {
      handle.close();
      delete this.handlers[localID];
      this._count--;
    }
  }

  public removeAll() {
    for(const key in this.handlers) {
      this.handlers[key].close();
    }
    this.handlers = {};
    this._count = 0;
  }
}