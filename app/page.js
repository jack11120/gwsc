"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Heart, Send, Shield, Crown, Sparkles, MessageCircle, UserPlus, Search } from "lucide-react";

const copy = {
  zh: {
    title: "GWSC 表白墙",
    subtitle: "匿名浏览 · 实名投稿 · 学生专属的轻松小角落",
    switch: "English",
    loginTitle: "登录 / 注册",
    loginSub: "注册时必须填写真实姓名和年级。别人看不到，只有管理者审核时能看到。",
    email: "邮箱",
    password: "密码，至少 6 位",
    displayName: "昵称 / Display name",
    realName: "真实姓名 / Real name",
    yearLevel: "年级 / Year level",
    avatar: "选择头像",
    privacy: "管理者不会泄露你的真实姓名和年级。投稿审核只用于防止冒充、霸凌和恶意内容。",
    signUp: "注册",
    signIn: "登录",
    signOut: "退出",
    anonymousBrowse: "匿名浏览",
    myId: "我的 ID",
    submitPost: "投稿",
    placeholder: "写点想说的话……可以表白、感谢、道歉、夸人，但不要攻击别人。",
    receiver: "想投稿给谁？可不填",
    useRealNameNotice: "投稿必须绑定真实姓名，但公开显示可以选择匿名。",
    postAnonymously: "公开匿名显示",
    sendToReview: "提交审核",
    pending: "待审核",
    approved: "已通过",
    comments: "评论",
    addComment: "写评论……",
    commentLimit: "你已经评论 3 条啦。想继续评论？提示：请转账 1r 解锁 1 条评论 😭",
    adminPanel: "管理后台",
    ownerPanel: "群主控制台",
    approve: "通过",
    delete: "删帖",
    block: "拉黑用户",
    unblock: "解除拉黑",
    deleteComment: "删评论",
    makeAdmin: "设为管理员",
    removeAdmin: "取消管理员",
    transferOwner: "移交群主",
    cannotKickOwner: "管理员不能踢群主。",
    friends: "好友",
    addFriend: "加好友",
    chat: "私聊",
    message: "输入私聊消息……",
    bonus: "加评论次数",
    roleOwner: "群主",
    roleAdmin: "管理员",
    roleUser: "普通用户",
    realInfoHidden: "实名信息已隐藏，仅管理者可见",
    feed: "表白动态",
    search: "搜索昵称 / 内容",
    empty: "还没有内容，先投一条吧。",
    loading: "加载中……"
  },
  en: {
    title: "GWSC Confession Wall",
    subtitle: "Anonymous browsing · Real-name submission · A soft student corner",
    switch: "中文",
    loginTitle: "Sign in / Sign up",
    loginSub: "You must provide your real name and year level when registering. Only managers can see it.",
    email: "Email",
    password: "Password, at least 6 characters",
    displayName: "Display name / 昵称",
    realName: "Real name / 真实姓名",
    yearLevel: "Year level / 年级",
    avatar: "Choose avatar",
    privacy: "Managers will not reveal your real name or year level. Review is only used to prevent impersonation, bullying and harmful posts.",
    signUp: "Sign up",
    signIn: "Sign in",
    signOut: "Sign out",
    anonymousBrowse: "Browse anonymously",
    myId: "My ID",
    submitPost: "Submit",
    placeholder: "Write something kind — confession, thanks, apology, praise. No personal attacks.",
    receiver: "Who is this for? optional",
    useRealNameNotice: "Submissions must be connected to your real name, but public display can be anonymous.",
    postAnonymously: "Show publicly as anonymous",
    sendToReview: "Send for review",
    pending: "Pending",
    approved: "Approved",
    comments: "Comments",
    addComment: "Write a comment…",
    commentLimit: "You have already made 3 comments. Want more? Tip: transfer 1r to unlock 1 extra comment 😭",
    adminPanel: "Admin panel",
    ownerPanel: "Owner console",
    approve: "Approve",
    delete: "Delete post",
    block: "Block user",
    unblock: "Unblock",
    deleteComment: "Delete comment",
    makeAdmin: "Make admin",
    removeAdmin: "Remove admin",
    transferOwner: "Transfer owner",
    cannotKickOwner: "Admins cannot remove the owner.",
    friends: "Friends",
    addFriend: "Add friend",
    chat: "Private chat",
    message: "Type a message…",
    bonus: "Add comment chances",
    roleOwner: "Owner",
    roleAdmin: "Admin",
    roleUser: "User",
    realInfoHidden: "Real info hidden, visible only to managers",
    feed: "Confession feed",
    search: "Search name / content",
    empty: "No posts yet. Submit the first one.",
    loading: "Loading…"
  }
};

function roleText(role, t) {
  if (role === "owner") return t.roleOwner;
  if (role === "admin") return t.roleAdmin;
  return t.roleUser;
}

function Avatar({ url, small = false }) {
  return <div className={small ? "avatar small" : "avatar"}>{url ? <img src={url} alt="avatar" /> : null}</div>;
}

function Pill({ children, tone = "" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export default function Page() {
  const [lang, setLang] = useState("zh");
  const t = copy[lang];

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [friends, setFriends] = useState([]);

  const [authForm, setAuthForm] = useState({ email: "", password: "", displayName: "", realName: "", year: "Year 11", avatarFile: null });
  const [postForm, setPostForm] = useState({ target: "", body: "", anonymous: true });
  const [commentText, setCommentText] = useState({});
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [browseAnon, setBrowseAnon] = useState(false);
  const [selectedChat, setSelectedChat] = useState("");

  const isManager = profile?.role === "owner" || profile?.role === "admin";
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) bootstrap(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) bootstrap(newSession.user.id);
      else {
        setProfile(null);
        setPosts([]);
        setAllProfiles([]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel("gwsc-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => loadComments())
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" }, () => loadMessages())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, profile]);

  async function bootstrap(userId) {
    await loadProfile(userId);
    await Promise.all([loadPosts(), loadComments(), loadProfiles(), loadMessages(), loadFriends()]);
  }

  async function loadProfile(userId = session?.user?.id) {
    if (!userId) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!error) setProfile(data);
  }

  async function loadProfiles() {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) {
      setAllProfiles(data);
      if (!selectedChat) {
        const first = data.find((u) => u.id !== session?.user?.id);
        if (first) setSelectedChat(first.id);
      }
    }
  }

  async function loadPosts() {
    const { data } = await supabase.from("posts").select("*").neq("status", "deleted").order("created_at", { ascending: false });
    if (data) setPosts(data);
  }

  async function loadComments() {
    const { data } = await supabase.from("comments").select("*").order("created_at", { ascending: true });
    if (data) setComments(data);
  }

  async function loadMessages() {
    const { data } = await supabase.from("private_messages").select("*").order("created_at", { ascending: true });
    if (data) setMessages(data);
  }

  async function loadFriends() {
    const { data } = await supabase.from("friendships").select("*");
    if (data) setFriends(data);
  }

  async function uploadAvatar(userId, file) {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  }

  async function signUp() {
    setNotice("");
    if (!authForm.email || !authForm.password || !authForm.displayName || !authForm.realName || !authForm.year) {
      setNotice(lang === "zh" ? "邮箱、密码、昵称、真实姓名、年级都要填。" : "Email, password, display name, real name and year level are required.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password
    });
    if (error) {
      setNotice(error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setNotice(lang === "zh" ? "请去邮箱确认注册，然后再登录。" : "Please confirm your email, then sign in.");
      return;
    }

    try {
      const avatarUrl = await uploadAvatar(user.id, authForm.avatarFile);
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        email: authForm.email,
        display_name: authForm.displayName,
        real_name: authForm.realName,
        year_level: authForm.year,
        avatar_url: avatarUrl,
        role: "user"
      });
      if (profileError) setNotice(profileError.message);
      else {
        setNotice(lang === "zh" ? "注册成功。第一次使用时，请在 Supabase 把你的账号设为 owner。" : "Signed up. For first use, set your account as owner in Supabase.");
        await bootstrap(user.id);
      }
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
    if (error) setNotice(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const commentCountByMe = comments.filter((c) => c.author_id === profile?.id).length;
  const maxComments = 3 + (profile?.extra_comments || 0);

  const visiblePosts = useMemo(() => {
    return posts
      .filter((p) => isManager || p.status === "approved" || p.author_id === profile?.id)
      .filter((p) => `${p.body} ${p.target} ${p.public_author_name}`.toLowerCase().includes(query.toLowerCase()));
  }, [posts, isManager, query, profile]);

  async function submitPost() {
    if (!postForm.body.trim() || !profile) return;
    if (profile.blocked) {
      setNotice(lang === "zh" ? "你已被拉黑，不能投稿。" : "You are blocked and cannot submit.");
      return;
    }
    const { error } = await supabase.from("posts").insert({
      author_id: profile.id,
      target: postForm.target,
      body: postForm.body,
      anonymous: postForm.anonymous,
      status: "pending",
      public_author_name: profile.display_name,
      public_author_avatar: profile.avatar_url
    });
    if (error) setNotice(error.message);
    else {
      setPostForm({ target: "", body: "", anonymous: true });
      setNotice(lang === "zh" ? "已提交审核。" : "Sent for review.");
      loadPosts();
    }
  }

  async function approvePost(id) {
    await supabase.from("posts").update({ status: "approved" }).eq("id", id);
    loadPosts();
  }

  async function deletePost(id) {
    await supabase.from("posts").update({ status: "deleted" }).eq("id", id);
    loadPosts();
  }

  async function likePost(post) {
    await supabase.from("posts").update({ likes: (post.likes || 0) + 1 }).eq("id", post.id);
    loadPosts();
  }

  async function addComment(postId) {
    const body = (commentText[postId] || "").trim();
    if (!body) return;
    if (commentCountByMe >= maxComments) {
      setNotice(t.commentLimit);
      return;
    }
    const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: profile.id, body });
    if (error) setNotice(error.message);
    else {
      setCommentText({ ...commentText, [postId]: "" });
      loadComments();
    }
  }

  async function deleteComment(id) {
    await supabase.from("comments").delete().eq("id", id);
    loadComments();
  }

  async function blockUser(user, blocked = true) {
    if (user.role === "owner") {
      setNotice(t.cannotKickOwner);
      return;
    }
    await supabase.from("profiles").update({ blocked }).eq("id", user.id);
    loadProfiles();
  }

  async function makeAdmin(user) {
    if (!isOwner || user.role === "owner") return;
    await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
    loadProfiles();
  }

  async function removeAdmin(user) {
    if (!isOwner || user.role !== "admin") return;
    await supabase.from("profiles").update({ role: "user" }).eq("id", user.id);
    loadProfiles();
  }

  async function transferOwner(user) {
    if (!isOwner || user.id === profile.id) return;
    await supabase.from("profiles").update({ role: "admin" }).eq("id", profile.id);
    await supabase.from("profiles").update({ role: "owner" }).eq("id", user.id);
    await bootstrap(profile.id);
  }

  async function addBonus(user) {
    await supabase.from("profiles").update({ extra_comments: (user.extra_comments || 0) + 1 }).eq("id", user.id);
    loadProfiles();
  }

  async function addFriend(friendId) {
    await supabase.from("friendships").insert({ user_id: profile.id, friend_id: friendId });
    loadFriends();
  }

  async function sendMessage() {
    const input = document.getElementById("chatInput");
    const body = input?.value.trim();
    if (!body || !selectedChat) return;
    await supabase.from("private_messages").insert({ sender_id: profile.id, receiver_id: selectedChat, body });
    input.value = "";
    loadMessages();
  }

  if (!session || !profile) {
    return (
      <main className="loginScreen">
        <section className="loginBox card pad stack">
          <div className="between">
            <div>
              <h1>{t.loginTitle}</h1>
              <p className="sub">{t.loginSub}</p>
            </div>
            <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}>{t.switch}</button>
          </div>

          <div className="form2">
            <input placeholder={t.email} value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
            <input placeholder={t.password} type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
            <input placeholder={t.displayName} value={authForm.displayName} onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })} />
            <input placeholder={t.realName} value={authForm.realName} onChange={(e) => setAuthForm({ ...authForm, realName: e.target.value })} />
            <input placeholder={t.yearLevel} value={authForm.year} onChange={(e) => setAuthForm({ ...authForm, year: e.target.value })} />
            <label className="soft row" style={{ cursor: "pointer", justifyContent: "center" }}>
              {t.avatar}
              <input style={{ display: "none" }} type="file" accept="image/*" onChange={(e) => setAuthForm({ ...authForm, avatarFile: e.target.files?.[0] || null })} />
            </label>
          </div>

          <div className="notice"><Shield size={16} /> {t.privacy}</div>
          {notice && <p className="error">{notice}</p>}

          <div className="tabs">
            <button onClick={signUp}>{t.signUp}</button>
            <button className="secondary" onClick={signIn}>{t.signIn}</button>
          </div>
        </section>
      </main>
    );
  }

  const chatUsers = allProfiles.filter((u) => u.id !== profile.id);
  const selectedUser = allProfiles.find((u) => u.id === selectedChat);

  return (
    <>
      <header>
        <div className="topbar">
          <div className="brand">
            <div className="logo"><Sparkles /></div>
            <div>
              <h1>{t.title}</h1>
              <p className="sub">{t.subtitle}</p>
            </div>
          </div>
          <div className="tabs">
            <button className="secondary" onClick={() => setBrowseAnon(!browseAnon)}>{t.anonymousBrowse}</button>
            <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}>{t.switch}</button>
            <button className="secondary" onClick={signOut}>{t.signOut}</button>
          </div>
        </div>
      </header>

      <main className="wrap grid">
        <aside className="left stack">
          <section className="card pad stack">
            <div className="row">
              <Avatar url={browseAnon ? null : profile.avatar_url} />
              <div>
                <h3>{browseAnon ? "Anonymous" : profile.display_name}</h3>
                <p className="mini">{t.myId}: {browseAnon ? "Hidden" : profile.id.slice(0, 8)}</p>
              </div>
            </div>
            <div className="tabs">
              <Pill tone={profile.role === "owner" ? "yellow" : profile.role === "admin" ? "green" : ""}>{roleText(profile.role, t)}</Pill>
              <Pill tone="pink">{commentCountByMe}/{maxComments} {t.comments}</Pill>
            </div>
            <div className="notice"><Shield size={16} /> {t.privacy}</div>
          </section>

          <section className="card pad stack">
            <h2><UserPlus size={20} /> {t.friends}</h2>
            {chatUsers.map((u) => (
              <div className="friend between" key={u.id}>
                <div className="row">
                  <Avatar url={u.avatar_url} small />
                  <div><b>{u.display_name}</b><div className="mini">{roleText(u.role, t)}</div></div>
                </div>
                <div className="tabs">
                  <button className="secondary" onClick={() => addFriend(u.id)}>{t.addFriend}</button>
                  <button onClick={() => setSelectedChat(u.id)}>{t.chat}</button>
                </div>
              </div>
            ))}
          </section>
        </aside>

        <section className="middle stack">
          <section className="card pad stack">
            <div className="between">
              <h2>{t.submitPost}</h2>
              <Pill tone="yellow">{t.useRealNameNotice}</Pill>
            </div>
            <input placeholder={t.receiver} value={postForm.target} onChange={(e) => setPostForm({ ...postForm, target: e.target.value })} />
            <textarea placeholder={t.placeholder} value={postForm.body} onChange={(e) => setPostForm({ ...postForm, body: e.target.value })} />
            <div className="between">
              <label className="row"><input style={{ width: "auto" }} type="checkbox" checked={postForm.anonymous} onChange={(e) => setPostForm({ ...postForm, anonymous: e.target.checked })} /> {t.postAnonymously}</label>
              <button onClick={submitPost}><Send size={16} /> {t.sendToReview}</button>
            </div>
            {notice && <div className="soft error">{notice}</div>}
          </section>

          <div className="between">
            <h2>{t.feed}</h2>
            <div className="search"><Search size={16} /><input placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          </div>

          {visiblePosts.length === 0 ? <div className="card empty">{t.empty}</div> : visiblePosts.map((post) => {
            const author = allProfiles.find((u) => u.id === post.author_id);
            const postComments = comments.filter((c) => c.post_id === post.id);
            return (
              <article className="card" key={post.id}>
                <div className="postHead">
                  <div className="between">
                    <div className="row">
                      <Avatar url={post.anonymous ? null : post.public_author_avatar} />
                      <div>
                        <div className="row" style={{ flexWrap: "wrap" }}>
                          <b>{post.anonymous ? "Anonymous" : post.public_author_name}</b>
                          <Pill tone={post.status === "approved" ? "green" : "yellow"}>{post.status === "approved" ? t.approved : t.pending}</Pill>
                          {post.target && <Pill>to: {post.target}</Pill>}
                        </div>
                        <div className="mini">{new Date(post.created_at).toLocaleString()} · {t.realInfoHidden}</div>
                      </div>
                    </div>
                    <span className="muted">•••</span>
                  </div>
                  <div className="postBody">{post.body}</div>
                  <div className="tabs" style={{ marginTop: 15 }}>
                    <button className="secondary" onClick={() => likePost(post)}><Heart size={16} /> {post.likes}</button>
                    <Pill><MessageCircle size={14} /> {postComments.length} {t.comments}</Pill>
                  </div>
                </div>

                <div className="pad stack">
                  {postComments.map((c) => {
                    const cu = allProfiles.find((u) => u.id === c.author_id);
                    return (
                      <div className="comment" key={c.id}>
                        <div className="row" style={{ alignItems: "flex-start" }}>
                          <Avatar url={cu?.avatar_url} small />
                          <div><b>{cu?.display_name || "User"}</b><div>{c.body}</div></div>
                        </div>
                        {isManager && <button className="secondary" onClick={() => deleteComment(c.id)}>🗑️</button>}
                      </div>
                    );
                  })}
                  <div className="commentForm">
                    <input placeholder={t.addComment} value={commentText[post.id] || ""} onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addComment(post.id); }} />
                    <button onClick={() => addComment(post.id)}>➤</button>
                  </div>
                  {isManager && (
                    <div className="adminStrip">
                      {post.status === "pending" && <button className="good" onClick={() => approvePost(post.id)}>✓ {t.approve}</button>}
                      <button className="danger" onClick={() => deletePost(post.id)}>🗑️ {t.delete}</button>
                      {author && <button className="warn" onClick={() => blockUser(author, true)}>🚫 {t.block}</button>}
                      {author && <span className="real">Real: {author.real_name} · {author.year_level}</span>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <aside className="right stack">
          {isManager && (
            <section className="card pad stack">
              <h2>{isOwner ? <Crown size={20} /> : <Shield size={20} />} {isOwner ? t.ownerPanel : t.adminPanel}</h2>
              {allProfiles.map((u) => (
                <div className="userRow stack" key={u.id} style={{ gap: 10 }}>
                  <div className="between">
                    <div className="row"><Avatar url={u.avatar_url} small /><div><b>{u.display_name}</b><div className="mini">{u.real_name} · {u.year_level}</div></div></div>
                    <Pill tone={u.role === "owner" ? "yellow" : u.role === "admin" ? "green" : ""}>{roleText(u.role, t)}</Pill>
                  </div>
                  <div className="tabs">
                    {isOwner && u.role === "user" && <button className="secondary" onClick={() => makeAdmin(u)}>{t.makeAdmin}</button>}
                    {isOwner && u.role === "admin" && <button className="secondary" onClick={() => removeAdmin(u)}>{t.removeAdmin}</button>}
                    {isOwner && u.id !== profile.id && <button className="secondary" onClick={() => transferOwner(u)}>{t.transferOwner}</button>}
                    <button className="secondary" onClick={() => addBonus(u)}>🎁 {t.bonus}</button>
                    {u.role !== "owner" && <button className="secondary" onClick={() => blockUser(u, !u.blocked)}>{u.blocked ? t.unblock : t.block}</button>}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="card pad stack">
            <h2>{t.chat}</h2>
            <select value={selectedChat} onChange={(e) => setSelectedChat(e.target.value)}>
              {chatUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
            <div className="chatBox">
              {messages.filter((m) => (m.sender_id === profile.id && m.receiver_id === selectedChat) || (m.sender_id === selectedChat && m.receiver_id === profile.id)).map((m) => (
                <div className={`bubble ${m.sender_id === profile.id ? "me" : "them"}`} key={m.id}>{m.body}</div>
              ))}
            </div>
            <div className="commentForm">
              <input id="chatInput" placeholder={`${t.message}${selectedUser ? " @" + selectedUser.display_name : ""}`} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
              <button onClick={sendMessage}>➤</button>
            </div>
          </section>
        </aside>
      </main>
    </>
  );
}
