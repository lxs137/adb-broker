import * as log4js from "log4js";
const logger = log4js.getLogger("retryUtils");

export const pause = (duration: number) => {
  return new Promise(resolve => setTimeout(resolve, duration));
};

export const retry = (retryTimes: number, func: Function, delay: number = 1000): Promise<any> => {
  return func().catch(
    (err: any) => {
      if(retryTimes > 0) {
        logger.info("Can Retry %d times, wait %d", retryTimes, delay);
        // console.log("Can Retry %d times, wait %d", retryTimes, delay);
        return pause(delay).then(
          () => retry(retryTimes - 1, func, delay * 2)
        );
      } else {
        return Promise.reject(err);
      }
    }
  );
};