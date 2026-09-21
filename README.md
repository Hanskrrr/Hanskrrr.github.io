# Hanskrrr · Gallery

一个简单的个人静态网站。当前首页是等待布展的占位页，无框架、无后端、无第三方依赖。

访问地址：<https://hanskrrr.github.io/>

## 文件

- `index.html`：网站首页，直接编辑文字和样式即可。
- `.nojekyll`：让 GitHub Pages 直接发布静态文件，不使用 Jekyll 处理。
- `.gitignore`：防止本地备份和系统文件进入仓库。

## GitHub Pages 设置

打开 <https://github.com/Hanskrrr/Hanskrrr.github.io/settings/pages>：

1. Source 选择 **Deploy from a branch**。
2. Branch 选择 **main**，目录选择 **/(root)**。
3. 点击 **Save**（如果设置已一致，按钮会不可用）。
4. 在 Actions 中查看 `pages build and deployment` 是否成功。
5. 打开 <https://hanskrrr.github.io/>。提交后的更新可能需要最多 10 分钟。

默认的 `hanskrrr.github.io` 地址免费且强制使用 HTTPS，不需要购买域名，也不需要 CNAME 文件。

## 更新页面

最简单的方法是在 GitHub 上打开 `index.html`，点击编辑，修改后提交到 `main`。也可以在电脑上编辑，然后通过 Git 提交和推送。后续每次提交都会自动部署。

添加独立页面时，例如 `about.html`，发布后访问 `https://hanskrrr.github.io/about.html`。图片和音频使用相对路径引用，并确保实际文件也已上传。

## 可选：绑定自己的域名

只有已经持有域名时才需要这一步。Pages 托管免费，域名的注册和续费通常需要付费。

1. 在上面的 Pages 设置中，将 **Custom domain** 填为你实际持有的域名，不带 `https://` 或路径，点击 **Save**。
2. 到域名服务商配置对应 DNS。下面的 `example.com` 仅为示例，请替换为自己的域名。

如果使用 `www.example.com`：

| 类型 | 主机记录 | 目标 |
| --- | --- | --- |
| CNAME | www | hanskrrr.github.io |

如果使用根域名 `example.com`：

| 类型 | 主机记录 | 目标 |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

仅更改用于网站的记录，保留邮件等其他服务的记录。DNS 生效后，等待 GitHub 签发证书，再勾选 **Enforce HTTPS**。DNS 和证书处理可能需要 24 小时或更久。

从分支发布时，在 Pages 设置保存自定义域名会自动创建 `CNAME` 文件。仅手动改动或删除该文件，不能代替在 Pages 设置中绑定或移除域名。

官方文档：

- [创建 GitHub Pages 网站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [管理自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## 后续扩展

命令行入口、文章、相册、音频和加密区域可以后续逐步增加。当前占位页没有密码保护或加密功能。私密内容应先加密，再上传；不要把明文或密钥提交到公开仓库。

## 恢复旧版本

此次清理保留原有 Git 历史，没有重写或删除历史提交。清理前的提交为 `d5eee71f53071cefa9b4aeb11849768eeace241a`，需要时可从该版本恢复旧文件。

注意：移除当前版本中的文件，不会移除公开 Git 历史中的旧内容。
