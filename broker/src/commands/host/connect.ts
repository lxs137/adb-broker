import { AdbServerConnection } from "adb-server/adbServerConn";
import { ResponseCode, Command } from "commands";

// Possible response:
// "unable to connect to <deviceID>"
// "connected to <deviceID>"
// "already connected to <deviceID>"
const RESPONSE_OK = /connected to|already connected/;

export class ConnectDeviceCommand extends Command {
  private deviceID: string;
  constructor(connection: AdbServerConnection, deviceID: string) {
    super(connection);
    this.deviceID = deviceID;
  }

  public execute(): Promise<any> {
    return this.send(`host:connect:${this.deviceID}`).then(
      () => this.parser.readASCII(4)
    ).then(
      (responseCode) => {
        if(responseCode === ResponseCode.OKAY) {
          return this.parser.readValue().then(
            (response) => {
              if(RESPONSE_OK.test(<any>response))
                return Promise.resolve(this.deviceID);
              else
                return Promise.reject(response.toString());
            }
          );
        } else if (responseCode === ResponseCode.FAIL) {
          return this.parser.readError().then(
            (errStr) => Promise.reject(new Error(errStr))
          );
        } else {
          return Promise.reject(
            new Error("Unexpected response('OKAY' or 'FAIL'): " + responseCode));
        }
      }
    );
  }
}