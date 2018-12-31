## How ADB Works

#### Get Code

`git clone https://android.googlesource.com/platform/system/adb`

#### Establish Connection

When you input `adb connect <serial>`, why connection state become `device` or `offline`. There are `1 + 2 * N` threads in AdbServer, every connection has a atransport object, every transport has two threads.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/connect_device.png)

#### Verify Auth Permission

when set `ro.secure=1` in Android, ADB Daemon will do something to check auth permission before send `CNXN` Packet to AdbServer.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/establish_connection.png)

#### Execute Command

When you input `adb -s <serial> <command>`, command may be `shell` or others.

![](https://raw.githubusercontent.com/lxs137/adb-broker/master/doc/exec_command.png)