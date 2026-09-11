# 自动部署

线上地址：https://beads.corcky.top/

推送 main 分支会触发 .github/workflows/deploy.yml；也可以在 GitHub Actions 的 Deploy 工作流中手动运行。流水线使用标准 GitHub 托管 Linux Runner 和 Node.js 24，先安装依赖、检查 TypeScript 并构建，成功后上传腾讯云服务器部署。无需手动打包上传。

仓库的 Actions Secrets：
- DEPLOY_SSH_KEY：专用 SSH 私钥。
- DEPLOY_KNOWN_HOSTS：通过腾讯云终端核实过的服务器 SSH 身份公钥。

服务器使用 ubuntu 用户，站点总目录为 /home/ubuntu/apps/sites。
构建结果同步到 beads 目录内，由现有 Caddy 容器提供服务，无需重启容器。

部署后会检查 /deploy-version.txt 是否与提交 SHA 一致。失败时在 GitHub Actions 中查看失败步骤的日志。构建失败不会上传；部署阶段失败则需要根据日志检查，不自动回滚。

工作流不会改动 Caddyfile、域名解析或证书卷。同一仓库的部署串行执行。私钥保存在 GitHub Secrets 和本机用户 .ssh 目录，不要提交到仓库。
