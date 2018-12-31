import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as mkdirp from "mkdirp";
import * as log4js from "log4js";
const logger = log4js.getLogger("fileUtils");

export const ensureDir = (dir: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    mkdirp(dir, (err: NodeJS.ErrnoException) => {
      if(err) {
        logger.error("EnsureDir(%s) error: %s", dir, err.message);
        reject(err);
      } else {
        resolve(dir);
      }
    });
  });
};

export const combinePath = (...paths: string[]): string => {
  let p = "";
  paths.forEach((item) => {
    p = path.join(p, item);
  });
  return path.normalize(p).replace(/\\/g, "/");  
};

export const absolutePath = (filePath: string): string => {
  if(!path.isAbsolute(filePath)) {
    return path.resolve(filePath);
  }
  return filePath;
};

export const deleteFolderRecursive = (path: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function (file, index) {
        const curPath = combinePath(path, file);
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
    resolve(true);
  }); 
};

export const downloadFile = (url: string, name: string, dir: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    ensureDir(dir).then(
      () => {
        const filePath = combinePath(dir, name);
        
        http.get(url, (response) => {
          if (response.statusCode !== 200) {
            return reject("StatusCode: " + response.statusCode);
          }
          const file: any = fs.createWriteStream(filePath);
          response.pipe(file);
          file.on("finish", () => {
            file.close(() => {
              resolve(filePath);
            });
          });
        }).on("error", (err: Error) => {
          fs.unlink(filePath, undefined);
          reject(err.message);
        });
      }
    ).catch(
      () => reject()
    );
  });
};

export const writeFile = (filepath: string, content: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(filepath)).then(
      (dir) => {
        fs.writeFile(filepath, content, undefined, (err) => {
          if (err) {
            reject(err);
          }
          resolve(filepath);
        });
      }, 
      (err) => reject(err)
    );
  });
};