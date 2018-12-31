## How ADB Works

#### Get Code

`git clone https://android.googlesource.com/platform/system/adb`

#### Architecture

There are three components in ADB: Client, AdbServer, Adb Daemon. Client and AdbServer always run on your PC, Adb Daemon (adbd) run on your Android device.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/architecture.jpg)

#### Establish Connection

When you input `adb connect <serial>`, why connection state become `device` or `offline`. There are `1 + 2 * N` threads in AdbServer, every connection has a atransport object, every transport has two threads.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/connect_device.png)

#### Verify Auth Permission

ADB Daemon will do something to check auth permission before send `CNXN` Packet to AdbServer.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/establish_connection.png)

#### Execute Command

When you input `adb -s <serial> <command>`, command may be `shell` or others.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/exec_command.png)