import { Command, ResponseCode } from "commands/command";

const PROP_REGEX = /^\[([\s\S]*?)\]: \[([\s\S]*?)\]\r?$/gm;

export class GetPropCommand extends Command {
  public execute(): Promise<any> {
    return this.send("shell:getprop").then(
      () => this.parser.readASCII(4)
    ).then(
      (response) => {
        if(response === ResponseCode.OKAY) {
          return this.parser.readAll().then(
            (data) => {
              const props: any = {};
              const dataStr = data.toString();
              let match;
              while(match = PROP_REGEX.exec(dataStr)) {
                props[match[1]] = match[2];
              }
              return props;
            }
          );
        } else if(response === ResponseCode.FAIL) {
          return this.parser.readError().then(
            (errStr) => Promise.reject(new Error(errStr))
          );
        } else {
          return Promise.reject(
            new Error("Unexpected response('OKAY' or 'FAIL'): " + response));
        }
      }
    );
  }
}