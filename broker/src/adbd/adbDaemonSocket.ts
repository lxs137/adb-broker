import { Socket } from "net";
import { EventEmitter } from "events";
import { randomBytes } from "crypto";
import { pki } from "node-forge";
import { PacketReader } from "adbd/packetReader";
import { CommandHandler, CommandHandlers } from "adbd/commandHandler";
import { Packet, PacketCommand, AuthPacketType, getSwap32 } from "adbd/packet";
import { parsePublicKey } from "utils/auth";
import { CommandHelper } from "commandHelper";
const logger = require("log4js").getLogger("adbDaemonSocket");

const UINT32_MAX = 0xFFFFFFFF;
const UINT16_MAX = 0xFFFF;
const TOKEN_LENGTH = 20;

const DevicePropKeys = [
  "ro.product.name",
  "ro.product.model",
  "ro.product.device"
];

export interface AdbDaemonAuthFunc {
  (key: pki.Certificate): boolean;
}

export class AdbDaemonSocket extends EventEmitter {
  private deviceID: string;
  private authVerify: AdbDaemonAuthFunc;
  private isEnd: boolean = false;
  private authorized: boolean = false;
  private version: number = 1;
  private maxPayload: number = 4096;
  private socket: Socket;
  private reader: PacketReader;
  private syncSeq: Counter = new Counter(UINT32_MAX);
  private token: Buffer;
  private signature: Buffer;
  private commandHandlerSeq: Counter = new Counter(UINT32_MAX);
  private handlers: CommandHandlers = new CommandHandlers();

  constructor(deviceID: string, conn: Socket, auth: AdbDaemonAuthFunc) {
    super();
    this.deviceID = deviceID;
    this.socket = conn;
    this.socket.setNoDelay(true);
    this.authVerify = auth;
    this.isEnd = false;
    this.reader = new PacketReader(conn);
    this.reader.on("packet", (packet: Packet) => this.handlePacket(packet));
    this.reader.on("error", (err: Error) => {
      logger.error("Read Packet error: %s", err.message);
      this.end();
    });
    this.reader.on("end", () => this.end());
  }

  private handlePacket(packet: Packet) {
    if(this.isEnd)
      return;
    logger.debug("Input packet: %s", packet.toString());
    switch (packet.command) {
      case PacketCommand.A_AUTH:
        this.handleAuthPacket(packet); break;
      case PacketCommand.A_CNXN:
        this.handleConnectPacket(packet); break;
      case PacketCommand.A_SYNC:
        this.handleSyncPacket(packet); break;
      case PacketCommand.A_OPEN:
        this.handleCommandExecPacket(packet); break;
      case PacketCommand.A_WRTE:
      case PacketCommand.A_OKAY:
      case PacketCommand.A_CLSE:
        this.transPacketToCommandHandler(packet); break;
    } 
  }

  private handleAuthPacket(packet: Packet) {
    switch (packet.arg0) {
      case AuthPacketType.SIGNATURE: {
        this.signature = packet.data;
        if (!this.signature)
          return;
        // This is a fake Android device, doesn't has public key
        // So sign failed, send Auth(Token) msg as response
        // Another side will use other PrivateKey to sign this token
        this.write(Packet.genSendPacket(PacketCommand.A_AUTH,
          AuthPacketType.TOKEN, 0, this.token));
        break;
      }
      case AuthPacketType.RSAPUBLICKEY: {
        if (!this.signature) {
          logger.error("Public key sent before signature");
          return;
        }
        // packet.data may be "\0" 
        if (!(packet.data && packet.data.length >= 2)) {
          logger.error("Empty RSA public Key");
          return;
        }
        logger.debug("Receive RSA Public Key: %s", packet.data.toString("base64"));
        parsePublicKey(packet.data).then(
          (key) => {
            const digestBin = this.token.toString("binary");
            const signatureBin = this.signature.toString("binary");
            if (!key.verify(digestBin, signatureBin)) {
              logger.error("Signature mismatch");
              return Promise.reject("Signature mismatch");
            }
            if (!this.authVerify(key)) {
              logger.error("Auth failed by custom auth function");
              return Promise.reject("Auth Failed");
            }
            logger.debug("Auth verify pass");
            return Promise.resolve(key);
          },
          (err) => {
            logger.error("Parse Public Key err: %s", err.message);
            return Promise.reject("Parse Public Key err");
          }
        ).then(
          (key) => {
            return CommandHelper.getDeviceProps(this.deviceID).then(
              (props) => {
                const info = DevicePropKeys.map(key => {
                  if(props[key])
                    return `${key}=${props[key]}`;
                  else
                    return "";
                }).join("");
                const infoStr = `device::${info}\0`;
                return Promise.resolve(new Buffer(infoStr));
              }
            ).catch(
              (err) => {
                logger.error("Get device props err: %s", err.message);
                return Promise.reject("Get device props err");
              }
            );
          }
        ).then(
          (info) => {
            this.authorized = true;
            this.write(Packet.genSendPacket(PacketCommand.A_CNXN, 
              getSwap32(this.version), this.maxPayload, info));
          }
        ).catch(
          (err) => logger.error("Handle Auth Packet Error: %s", err)
        );
        break;
      }
    }
  }

  private handleConnectPacket(packet: Packet) {
    this.maxPayload = Math.min(UINT16_MAX, packet.arg1);
    randomBytes(TOKEN_LENGTH, (err, token) => {
      if(err) {
        logger.error("Create random token err: %s", err.message);
        return;
      }
      this.token = token;
      logger.debug("Create token: %s", token.toString("base64"));
      this.write(Packet.genSendPacket(PacketCommand.A_AUTH,
         AuthPacketType.TOKEN, 0, token));
    });
  }

  private handleSyncPacket(packet: Packet) {
    this.write(Packet.genSendPacket(PacketCommand.A_SYNC, 1, 
      this.syncSeq.next(), undefined));
  }

  private handleCommandExecPacket(packet: Packet) {
    if(!this.authorized) {
      logger.error("Ignore unauthorized socket");
      return;
    }
    if(!packet.data || packet.data.length <= 1) {
      logger.error("Ignore empty packet");
      return;
    }
    const command = packet.data.toString();
    logger.info("Handle command: %s", command);
    const remoteID = packet.arg0;
    const localID = this.commandHandlerSeq.next();
    const handle = new CommandHandler(this.deviceID, localID, remoteID, this.maxPayload, this.socket);
    this.handlers.add(localID.toString(), handle);
    logger.debug("%s CommandHandlers is handling", this.handlers.count);
    handle.on("end", () => {
      this.handlers.remove(localID.toString());
      logger.info("'%s' handle is done", command);
    });
    handle.on("error", (err) => {
      this.handlers.remove(localID.toString());
      logger.error("'%s' handle has err: %s", command, err.message);
    });
    handle.handle(packet);
  }

  private transPacketToCommandHandler(packet: Packet) {
    if (!this.authorized) {
      logger.error("Ignore unauthorized socket");
      return;
    }
    const localID = packet.arg1;
    const handle = this.handlers.get(localID.toString());
    if(handle)
      handle.handle(packet);
    else
      logger.debug("local-id(%s) handle is not exist, ignore packet", localID);
  }

  public write(packet: Packet) {
    if(this.isEnd)
      return;
    logger.debug("Output packet: %s", packet.toString());
    this.socket.write(packet.toBuffer());
  }

  public end() {
    if(this.isEnd)
      return;
    this.socket.end();
    this.handlers.removeAll();
    this.isEnd = true;
    this.emit("end");
  }
}

export class Counter {
  private cur: number;
  private max: number;
  private min: number;
  constructor(max: number, min: number = 1) {
    this.cur = min;
    this.max = max;
    this.min = min;
  }
  public next() {
    if(this.cur < this.max)
      this.cur++;
    else
      this.cur = this.min + 1;
    return this.cur;
  }
}