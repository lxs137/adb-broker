import * as log4js from "log4js";
import * as net from "net";
import { ensureDeviceConnect } from "utils/adbUtils";
import { AdbDaemonServer } from "adbd/adbDaemonServer";

log4js.configure({
  appenders: {
    console: { type: "console" }
  },
  categories: {
    default: { appenders: ["console"], level: "debug" }
  }
});
const server = new AdbDaemonServer("01ce8e1c90cdeb12", () => true);
server.listen({
  port: 20001
});