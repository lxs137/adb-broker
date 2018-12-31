import * as cp from "child_process";
import * as path from "path";
import { cmdExec } from "utils/command";
import { getLogger } from "log4js";
const logger = getLogger("adbUtils");

export const disconnectAll = (): Promise<any> => {
  logger.info("disconnect all adb connection");
  return cmdExec("adb disconnect");
};

export const disconnectDevice = (ip: string): Promise<any> => {
  const cmd: string = `adb disconnect ${ip}`;
  return cmdExec(cmd);
};

export const connectDevice = (ip: string): Promise<any> => {
  const cmd: string = `adb connect ${ip}`;
  return cmdExec(cmd).then(
    (output) => {
      if(!output)
        return Promise.reject(false);
      if (output.includes("connected to")) {
        return Promise.resolve(true);
      } else if (output.includes("unable to connect to")) {
        return Promise.reject(false);
      }
      return Promise.resolve(true);
    }
  );
};

export const isDeviceConnected = (ip: string): Promise<boolean> => {
  const checkConnected: string = `adb devices | grep ${ip}`;
  return cmdExec(checkConnected).then(
    (isDeviceConnected) => Promise.resolve(isDeviceConnected ? true : false)
  ).catch(
    () => Promise.resolve(false)
  );
};

export const isDeviceOffline = (ip: string): Promise<boolean> => {
  const checkOffline: string = `adb devices | grep ${ip} | grep offline`;
  return cmdExec(checkOffline).then(
    (isDeviceOffline) => {
      if (isDeviceOffline) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }
  ).catch(
    () => Promise.resolve(false)
  );
};

export const ensureDeviceConnect = (ip: string): Promise<any> => {
  return isDeviceConnected(ip).then(
    (isConnected) => {
      if(!isConnected) {
        return connectDevice(ip);
      }
    }
  ).then(
    () => isDeviceOffline(ip)
  ).then(
    (isOffline) => {
      if(isOffline) {
        logger.error(`device ${ip} is offline`);
        return Promise.reject(`device ${ip} is offline`);
      } else {
        return Promise.resolve(true);
      }
    } 
  );
};

export const getWechatProcess = (ip: string): Promise<string[]> => {
  const psWechat: string = `adb -s ${ip} shell ps | grep com.tencent.mm | awk '{print $9}'`;
  return cmdExec(psWechat).then(
    (psRes) => {
      return psRes.split(/\s+/).filter((val: string) => val);
    }
  ).catch(
    () => {
      return [];
    }
  );
};

export const checkWechatForeground = (ip: string): Promise<boolean> => {
  const checkWechat: string = `adb -s ${ip} shell dumpsys window windows | grep mCurrentFocus | grep com.tencent.mm`;
  return cmdExec(checkWechat).then(
    (isForeground) => {
      if (isForeground) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }
  ).catch(
    () => Promise.resolve(false)
    );
};

export const callWechatToForeground = (ip: string): Promise<any> => {
  const command: string = `adb -s ${ip} shell am start com.tencent.mm/com.tencent.mm.ui.LauncherUI`;
  return cmdExec(command);
};

export const forwardProcessToLocalPort = (ip: string, psName: string, localPort: number): Promise<any> => {
  const command: string = `adb -s ${ip} forward tcp:${localPort} localabstract:${psName}`;
  return cmdExec(command);
};

export const disableForwardPort = (localPort: number): Promise<any> => {
  const command: string = `adb forward --remove tcp:${localPort}`;
  return cmdExec(command);
};