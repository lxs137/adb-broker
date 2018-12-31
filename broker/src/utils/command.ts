import * as cp from "child_process";

export const cmdExec = (cmd: string, options?: cp.ExecOptions): Promise<any> => {
  if (!cmd)
    return Promise.reject("command is empty");
  return new Promise((resolve, reject) => {
    cp.exec(cmd, options, (error, stdout, stderr) => {
      if (error)
        reject(error);
      // console.log(`cmd(${cmd}): ${stdout}`);
      resolve(stdout);
    });
  });
}; 

export const cmdFileExec = (cmd: string, args?: string[], options?: cp.ExecFileOptions): Promise<any> => {
  if (!cmd)
    return Promise.reject("command is empty");
  return new Promise((resolve, reject) => {
    const cb = (error: Error | null, stdout: string, stderr: string) => {
      if (error)
        reject(error);
      // console.log(`cmd(${cmd}): ${stdout}`);
      resolve(stdout);
    };
    if(args && args.length >= 1) {
      cp.execFile(cmd, args, options, cb);
    } else {
      cp.execFile(cmd, options, cb);
    }
  });
};