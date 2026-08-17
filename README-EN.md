# Sing-Box Multi-port Config Generator (SingMP-Gen)

[简体中文](/README.md) | English

A pure front-end web application designed to help users quickly and easily generate multi-port, multi-outbound configuration files for the `sing-box` core. It is particularly suitable for scenarios requiring the management of multiple independent network environments on a single computer using fingerprint browsers or different browsers with Socks5 nodes, such as in cross-border e-commerce operations and multi-account management.

[Demo](https://singmp.hotrue.cc/)

## What's the pain point?

Many cross-border e-commerce operators or developers have multiple proxy nodes, but common proxy clients (like Clash, v2RayN) only support a single global outbound by default. This makes it difficult to assign different outbound IPs to different applications or browser windows. Although the `sing-box` core supports "port-based traffic splitting" through complex configurations, manually writing the JSON configuration file is challenging and error-prone for non-technical users.

This tool automates this complex process through an intuitive graphical interface, allowing anyone to create a stable, DNS-leak-proof, multi-port proxy environment in minutes.

## ✨ Core Features

- **Easy Node Import**: Supports pasting an `outbounds` array directly or uploading a complete configuration file.
- **Smart Port Allocation**: Allows setting a starting port number for automatic incremental port assignment to all nodes, with support for manual modification.
- **One-Click Config Generation**: Quickly generates a complete, usable, and DNS-leak-proof `sing-box` configuration file based on user settings.
- **Pure Front-end Implementation**: All operations are performed locally in your browser. No backend server is needed, ensuring the absolute security and privacy of your node information.
- **Multi-language Support**: Provides interfaces in both Chinese and English, with automatic language detection based on your browser settings.
- **Templated Configuration**: The application logic is decoupled from the `sing-box` configuration template, making it easy for users to customize the template (`sing-box-template.json.tpl`) to their needs.
- **Robust Fault Tolerance**: Automatically cleans comments, trailing commas, and illegal control characters from the template file to ensure successful loading.

## 🚀 How to Use

Due to browser security policies, this project cannot be run by directly opening the `index.html` file via the `file://` protocol. You need to access it through a web server.
You can directly fork the project and then deploy it to your own Cloudflare Pages or Github Pages.

**Recommended Method: Using Python**

1. Ensure Python is installed on your computer.

2. Place all project files (`index.html`, `main.js`, `en.yml`, `zh.yml`, `sing-box-template.json.tpl`) in the same directory.

3. Open your terminal or command prompt and use the `cd` command to navigate to that directory.

4. Run one of the following commands to start a simple web server:

   ```
   # For Python 3
   python -m http.server 8000
   
   # For Python 2
   python -m SimpleHTTPServer 8000
   ```

5. Open your browser and navigate to `http://localhost:8000`.

You should now see the tool's interface and can start using it, as bellow.

![](img/Sing-Box-Multi-port-Config-Generator-01.png)

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML, JavaScript (ESM)
- **Styling**: Tailwind CSS
- **YAML Parsing**: JS-YAML

## 📁 Project Structure

```
.
├── index.html                  # Main page structure
├── main.js                     # Core application logic
├── sing-box-template.json.tpl  # sing-box config template (supports comments)
├── en.yml                      # English language pack
├── zh.yml                      # Chinese language pack
└── README.md                   # This file
```

## 🤝 Contribution

Thanks to Gemini. Pull Requests or Issues are welcome to help improve this project.

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).