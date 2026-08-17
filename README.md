# Sing-Box 多端口配置生成器 (SingMP-Gen)

[English](/README-EN.md) | 简体中文

一个纯前端实现的 Web 应用，旨在帮助用户快速、轻松地为 `sing-box` 内核生成多端口、多出口的配置文件。特别适用于需要在一台计算机上使用指纹浏览器或者不同浏览器，同时管理多个独立网络环境，使用 Socks5 节点的场景，如跨境电商运营、多账号管理等。

[Demo](https://singmp.hotrue.cc/)

## 解决了什么痛点？

许多跨境电商运营人员或开发者拥有多个代理节点，但常用的代理客户端（如 Clash, v2RayN）默认只允许一个全局出口。这意味着无法简单地为不同的应用程序或浏览器窗口分配不同的 Socks 出口 IP。虽然 `sing-box` 内核支持通过复杂的配置实现“分端口分流”，但手动编写 JSON 配置文件对非技术用户门槛高、易出错。

本工具通过一个直观的图形化界面，将这个复杂的过程自动化，让任何人都能在几分钟内创建出稳定、防泄漏的多端口代理环境。

## ✨ 核心功能

- **轻松导入节点**: 支持直接粘贴 `outbounds` 数组或上传完整的配置文件。
- **智能端口分配**: 可设置起始端口号，为所有节点自动分配递增的端口，并支持手动修改默认端口号。
- **一键生成配置**: 根据用户设置，快速生成一份完整、可用、防 DNS 泄漏的 `sing-box` 配置文件。
- **纯前端实现**: 所有操作均在您的浏览器本地完成，无需后端服务器，确保节点信息的绝对安全和隐私。
- **多语言支持**: 提供中文和英文界面，并可根据浏览器语言自动切换。
- **配置模板化**: 项目逻辑与 `sing-box` 配置模板分离，便于用户根据自己的需求定制模板 (`sing-box-template.json.tpl`)。
- **健壮的容错性**: 自动清理模板文件中的注释、尾随逗号和非法控制字符，确保加载成功。

## 🚀 如何使用

由于浏览器安全策略的限制，本项目不能直接通过 `file://` 协议打开 `index.html` 文件运行。您需要通过一个 Web 服务器来访问它。
当然也可以直接 Fork 项目，再部署到自己的 Cloudflare Pages 或者 Github Pages 上。

### 推荐方式：使用 Python

1. 确保您的电脑已安装 Python。

2. 将本项目的所有文件 (`index.html`, `main.js`, `en.yml`, `zh.yml`, `sing-box-template.json.tpl`) 放置在同一个目录下。

3. 打开终端或命令行工具，使用 `cd` 命令进入该目录。

4. 运行以下命令启动一个简单的 Web 服务器：

   ```
   # 如果您使用 Python 3
   python -m http.server 8000
   
   # 如果您使用 Python 2
   python -m SimpleHTTPServer 8000
   ```

5. 打开您的浏览器，访问 `http://localhost:8000`。

现在，您应该可以看到工具界面并开始使用了，如图：

![](img/Sing-Box-Multi-port-Config-Generator-01.png)

### 使用方法

打开工具网页，如上图。

1. 粘贴 sing-box 订阅链接或者直接粘贴 sing-box 格式的节点信息。

> [!note]
> 目前我觉得最方便好用的订阅节点管理和转换工具可以推荐 [Sub-Store](https://github.com/sub-store-org/Sub-Store)。

2. 设置起始端口，默认从 50000 开始。
3. 设置默认节点，可以按默认，或者根据自己需要设置一个默认节点。比如我们使用 v2rayN 最常用 10808 作本地监听默认端口。
4. 最后生成配置后，直接复制或者下载 `config.json` 到本地，导入客户端便可使用。

![](img/Sing-Box-Multi-port-Config-Generator-02.png)

5. 导入客户端，以 v2rayN 为例，通过 `配置文件` - `添加自定义配置文件` 导入配置

![](img/Sing-Box-Multi-port-Config-Generator-03.png)

6. 配置文件可以按需起个别名，`Core 类型` 那里需要选 `sing_box`。最后确定，再在主界面选择添加的这个配置激活就可以了。

![](img/Sing-Box-Multi-port-Config-Generator-04.png)

## 🛠️ 技术栈

- **前端**: 原生 HTML, JavaScript (ESM)
- **样式**: Tailwind CSS
- **YAML 解析**: JS-YAML

## 📁 项目结构

```
.
├── index.html                  # 主页面结构
├── main.js                     # 核心应用逻辑
├── sing-box-template.json.tpl  # sing-box 配置模板 (支持注释)
├── en.yml                      # 英文语言包
├── zh.yml                      # 中文语言包
└── README.md                   # 项目说明文件
```

## 🤝 贡献

感谢 Gemini，欢迎提交 Pull Requests 或 Issues 来帮助改进这个项目。

## 📄 许可证

本项目采用 [MIT License](https://opensource.org/licenses/MIT) 授权。