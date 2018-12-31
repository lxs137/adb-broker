import { EventEmitter } from "events";
import { Socket, connect } from "net";
import { CommandParser } from "adb-server/commandParser";
import { cmdFileExec } from "utils/command";
const logger = require("log4js").getLogger("adbServerConn");

interface AdbServerConnectionOpt {
  host?: string;
  port?: number;
  adbServerPath?: string;
}

/**
 * Send command to local adbserver, command's format:
 * https://android.googlesource.com/platform/system/core/+/master/adb/SERVICES.TXT
 */
export class AdbServerConnection extends EventEmitter {
  private options: AdbServerConnectionOpt;
  private socket: Socket;
  private tryStartServer: boolean = false;
  public parser: CommandParser;

  constructor(connOptions: AdbServerConnectionOpt) {
    super();
    this.options = connOptions;
    this.parser = undefined;
    this.socket = undefined;
  }

  public connect(): AdbServerConnection {
    this.socket = connect({
      host: this.options.host || "localhost",
      port: this.options.port || 5037
    });
    this.socket.setNoDelay(true);
    this.parser = new CommandParser(this.socket);
    this.socket.on("connect", () => this.emit("connect"));
    this.socket.on("end", () => this.emit("end"));
    this.socket.on("error", (err) => this.onError(err));
    this.socket.on("close", () => this.emit("colse"));
    return this;
  }

  public send(data: Buffer, cb: () => void) {
    if(!this.socket.write(data)) {
      this.socket.once("drain", cb);
    } else {
      process.nextTick(cb);
    }
  }

  public close() {
    logger.info(`Connection(${this.socket.localAddress}) close.`);
    this.socket.end();
  }

  private onError(err: NodeJS.ErrnoException) {
    if(err.code === "ECONNREFUSED" && !this.tryStartServer) {
      this.tryStartServer = true;
      logger.info("Try to start local adb server");
      cmdFileExec(this.options.adbServerPath || "adb", ["start-server"]).then(
        () => this.connect(),
        (execErr) => this.onError(execErr)
      );
    } else {
      logger.error("AdbServerConnection err: %s", err);
      this.close();
    }
  }
}