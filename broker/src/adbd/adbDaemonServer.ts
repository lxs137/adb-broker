import { Socket, Server, createServer, ListenOptions } from "net";
import { EventEmitter } from "events";
import { AdbDaemonSocket, AdbDaemonAuthFunc } from "adbd/adbDaemonSocket";
const logger = require("log4js").getLogger("adbDaemonServer");

/**
 * This server run on host to simulate an Android device's adbd
 */
export class AdbDaemonServer extends EventEmitter {
  private connections: AdbDaemonSocket[];
  private server: Server;
  private deviceID: string;

  constructor(deviceID: string, auth: AdbDaemonAuthFunc) {
    super();
    this.deviceID = deviceID;
    this.connections = [];
    this.server = createServer({
      allowHalfOpen: true
    });
    this.server.on("error", (err) => {
      logger.error("AdbDaemonServer error: %s", err.message);
      this.emit("error", err);
    });
    this.server.on("colse", () => {
      logger.info("AdbDaemonServer close");
      this.emit("close");
    });
    this.server.on("connection", (conn: Socket) => {
      const socket = new AdbDaemonSocket(this.deviceID, conn, auth);
      this.connections.push(socket);
      this.emit("connection", socket);
    });
  }

  /**
   * The Same as net.Server.listen 
   */
  public listen(args: ListenOptions) {
    this.server.listen(args);
    logger.info("AdbDaemonServer to %s is listen on %s:%d", 
      this.deviceID, args.host || "localhost", args.port);
  }

  public close() {
    this.server.close();
  }

  public end() {
    this.connections.forEach((conn) => conn.end());
  }
}