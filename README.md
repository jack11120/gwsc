# GWSC 表白墙 / GWSC Confession Wall

这是一个真正可部署的 Next.js + Supabase 版本。

## 功能
- 登录 / 注册
- 每个用户有自己的 ID
- 注册时填写真实姓名和年级
- 真实姓名和年级只给自己和管理员/群主看
- 中英文切换
- 匿名浏览
- 投稿审核
- 管理员后台
- 群主权限
- 设管理员 / 取消管理员
- 移交群主
- 删帖 / 通过审核 / 拉黑用户 / 删评论
- 每人默认 3 条评论机会
- 超过 3 条提示转账 1r
- 管理员可以给用户增加评论机会
- 头像上传
- 好友列表
- 私聊

## 部署方式，最简单版本

### 1. 创建 Supabase 项目
去 Supabase 创建一个新项目。

### 2. 建数据库
打开 Supabase 的 SQL Editor，把 `supabase/schema.sql` 里面的所有内容复制进去运行。

### 3. 创建第一个群主
先在网站注册你的账号。注册后，去 Supabase SQL Editor 运行：

```sql
update profiles
set role = 'owner'
where email = '你的邮箱@example.com';
```

### 4. 填环境变量
复制 `.env.example`，改名成 `.env.local`，填入你的 Supabase URL 和 anon key。

### 5. 本地运行
```bash
npm install
npm run dev
```

打开：
```text
http://localhost:3000
```

### 6. 上线到 Vercel
把项目上传到 GitHub，然后在 Vercel 导入项目。  
在 Vercel 的 Environment Variables 里填：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

然后 Deploy。

## 重要提醒
这个版本已经做了基本的权限和隐私设计，但如果真的给学校学生公开使用，建议加：
- 举报功能
- 敏感词过滤
- 使用条款
- 隐私说明
- 学校许可
- 管理员操作日志

因为这个网站会收集学生真实姓名、年级、头像和私聊内容，必须认真保护隐私。
