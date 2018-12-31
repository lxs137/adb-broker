import { EventEmitter } from "events";
import { CommandParser } from "adb-server/commandParser";
import { encode } from "adb-server/encoder";
import { AdbServerConnection } from "adb-server/adbServerConn";
const logger = require("log4js").getLogger("command");

export abstract class Command {
  protected conn: AdbServerConnection;
  protected parser: CommandParser;
  constructor(connection: AdbServerConnection) {
    this.conn = connection;
    this.parser = connection.parser;
  }
  
  public abstract execute(): Promise<any>;

  protected send(str: string): Promise<any> {
    return new Promise((resolve, reject) => {
      logger.info("Send command: %s", str);
      this.conn.send(encode(str), () => {
        resolve(str);
      });
    });
  }
}

export const ResponseCode = {
  OKAY: "OKAY",
  FAIL: "FAIL",
  STAT: "STAT",
  LIST: "LIST",
  DENT: "DENT",
  RECV: "RECV",
  DATA: "DATA",
  DONE: "DONE",
  SEND: "SEND",
  QUIT: "QUIT"
};
