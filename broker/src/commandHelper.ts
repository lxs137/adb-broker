import { GetPropCommand, TransportCommand, ConnectDeviceCommand } from "commands";
import { AdbServerConnection } from "adb-server/adbServerConn";
const logger = require("log4js").getLogger("adbCommandHelper");

const REMOTE_DEVICE_RE = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}:\d+$/;

export class CommandHelper {

  public static connect(host: string = "localhost", port: number = 5037, adbPath: string = "adb"): Promise<AdbServerConnection> {
    return new Promise((resolve, reject) => {
      const connection = new AdbServerConnection({
        host: host,
        port: port,
        adbServerPath: adbPath
      });
      connection.on("connect", () => {
        resolve(connection);
      });
      connection.connect();
    });
  }

  public static getDeviceProps(deviceID: string): Promise<any> {
    return this.transport(deviceID).then(
      (conn) => {
        const cmd = new GetPropCommand(conn);
        return cmd.execute().then(
          (props) => props,
          (err) => Promise.reject(new Error(
            `Get Properties error: ${err.message}`
          ))
        );
      }
    );
  }

  public static connectDevice(deviceID: string): Promise<AdbServerConnection> {
    if(!REMOTE_DEVICE_RE.exec(deviceID))
      return this.connect();
    return this.connect().then(
      (conn) => {
        const cmd = new ConnectDeviceCommand(conn, deviceID);
        return cmd.execute().then(
          () => Promise.resolve(conn),
          (err) => Promise.reject(new Error(
            `Connect to device(${deviceID}) err: ${err.message}`
          ))
        );
      }
    );
  }

  public static transport(deviceID: string): Promise<AdbServerConnection> {
    return this.connectDevice(deviceID).then(
      () => this.connect()
    ).then(
      (conn) => {
        const cmd = new TransportCommand(conn, deviceID);
        return cmd.execute().then(
          () => Promise.resolve(conn),
          (err) => Promise.reject(new Error(
            `Transport to ${deviceID} error: ${err.message}`
          ))
        );
      }
    );
  }

}