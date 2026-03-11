# 国内可访问永久网址（无需 VPN）

## 推荐方案：Gitee Pages
- 适合中国大陆访问
- 免费静态托管
- 地址长期可用

## 已准备好的脚本
- 运行 [DEPLOY_GITEE.cmd](file:///c:/Users/13926/Desktop/SAT%20SC/DEPLOY_GITEE.cmd)
- 脚本会自动：
  - 执行 `npm run build`
  - 生成 `docs/`（可直接给 Gitee Pages 使用）

## 你最终拿到的网址
- 项目站点：`https://<gitee-user>.gitee.io/<repo-name>/`
- 若你把仓库名设为 `<gitee-user>.gitee.io`，则可用根域名：
  - `https://<gitee-user>.gitee.io`

## 最快落地步骤
1. 在 Gitee 创建仓库（建议名 `moonspell-sat`）
2. 把当前项目上传到仓库（确保 `docs/` 在仓库里）
3. 打开仓库的「服务 -> Gitee Pages -> 启动」
4. 得到永久网址并可直接国内访问
