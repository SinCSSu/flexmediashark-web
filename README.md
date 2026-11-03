# FlexMediaShark Web

FlexMediaShark（Spring Boot 4 + Kotlin，插件化影片元数据刮削器）的 Web 控制台前端。
Vue 3 + TypeScript + Vite，无 UI 框架与网络库依赖，直接调用后端的 REST 接口。

## 功能页面

| 页面 | 对应后端接口 | 说明 |
|---|---|---|
| 刮削任务 | `POST /scrape/jobs`、`GET /scrape/jobs/{id}`、`POST /scrape/jobs/{id}/cancel` | 提交任务（路径/媒体库根目录、强制重刮、试运行），列表展示进度与结果分布，可取消。后端只提供按 ID 查询，任务 ID 保存在浏览器本地 |
| 任务详情 | `GET /scrape/jobs/{id}/items`、`GET /scrape/jobs/{id}/events` | SSE 实时进度 + 5 秒兜底轮询，逐文件明细含命中的解析器、数据源、条目引用与耗时，支持状态筛选与分页 |
| 识别预览 | `POST /scan/preview` | 只扫描解析不刮削，查看文件名被识别成什么（标题/年份/季集/绝对集号/区间/置信度/命中解析器/解析错误） |
| 待复核 | `GET /review/ambiguous`、`GET /review/{fileId}`、`POST confirm/reject`、`PATCH /review/{fileId}/fields` | 候选卡片式确认与「不是这部」拒绝（写负样本记忆），字段锁定与解除、字段溯源、字段冲突展示 |
| 插件配置 | `GET /config`、`PUT /config/{providers,parsers,sinks}/{id}` | 数据源、命名解析器、输出目标三族同权卡片：启停开关、priority/order 调序、参数编辑（凭据类输入自动掩码，值只回显键名） |

## 开发

```sh
npm install
npm run dev
```

默认把 `/scrape`、`/scan`、`/review`、`/config`、`/actuator` 代理到 `http://localhost:8080`
（后端 `server.port`）。后端不在本机时：

```sh
# Windows PowerShell
$env:FMS_BACKEND = "http://192.168.1.10:8080"; npm run dev
```

页面左下角「后端地址」输入框也可在运行时切换到任意后端地址（存 localStorage，留空表示同源）。

## 其他命令

```sh
npm run build       # vue-tsc 类型检查 + 生产构建
npm run type-check  # 仅类型检查
npm run preview     # 预览构建产物
```

生产部署时用任意静态服务器托管 `dist/`，并由同域反向代理转发上述接口前缀即可。
