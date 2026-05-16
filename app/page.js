"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Heart, Send, Shield, Crown, Sparkles, MessageCircle, UserPlus, Search, Home, User, Image as ImageIcon, Share2, Settings, Camera, X, Gamepad2, Users, IdCard } from "lucide-react";

const T = {
  title:"GWSC 表白墙", subtitle:"匿名浏览 · 实名投稿 · 学生专属的轻松小角落",
  wall:"表白墙", chats:"私聊", mine:"我的", email:"邮箱", password:"密码，至少 6 位",
  loginTitle:"登录 / 注册", loginSub:"注册时必须填写真实姓名和年级。别人看不到，只有群主/管理员审核时能看到。",
  displayName:"昵称", realName:"真实姓名", yearLevel:"年级", signUp:"注册", signIn:"登录", signOut:"退出",
  ruleTip:"可以投稿，但内容要经过审核员通过后才会公开。请礼貌发言，不要攻击别人，不要泄露他人隐私。",
  privacy:"管理者不会泄露你的真实姓名和年级。匿名帖只有群主可查看真实作者，管理员不会显示匿名作者。",
  submitPost:"投稿", receiver:"想投稿给谁？可不填", placeholder:"写点想说的话……可以表白、感谢、道歉、夸人，但不要攻击别人。",
  postAnon:"这条公开匿名", addPhoto:"添加照片", sendToReview:"提交审核", pending:"待审核", approved:"已通过",
  comments:"评论", addComment:"写评论……", commentRule:"每人前 20 条评论免费。超过 20 条后，每 5 条需要给群主转 3 块钱。",
  commentLimit:"你已经超过免费评论次数啦。之后每 5 条需要给群主转 3 块钱 😭",
  publicAdmins:"公开管理员", ownerPanel:"群主控制台", adminPanel:"管理后台", approve:"通过", delete:"删帖", block:"拉黑", unblock:"解除拉黑",
  makeAdmin:"设为管理员", removeAdmin:"取消管理员", transferOwner:"移交群主", bonus:"加评论次数", setUserId:"改用户 ID",
  friends:"好友", addById:"输入好友数字 ID 添加", addFriend:"加好友", openChat:"打开私聊", message:"输入私聊消息……",
  onlyId:"只能通过搜索数字 ID 加好友。表白墙匿名帖不能点主页；非匿名帖可以点主页并加好友。",
  like:"点赞", share:"转发", shareToFriend:"转发给好友", recommendFriend:"推荐好友", shareCard:"分享名片",
  profile:"个人主页", saveProfile:"保存资料", changeAvatar:"更改头像", changeBg:"更改主页背景", numericId:"数字 ID",
  roleOwner:"群主", roleAdmin:"管理员", roleUser:"普通用户", realHidden:"实名信息已隐藏，仅管理者可见",
  createGroup:"拉多人群", groupName:"群聊名称", inviteGomoku:"邀请五子棋", inviteChess:"邀请 Chess", empty:"还没有内容，先投一条吧。"
};

function roleText(role){ return role==="owner"?T.roleOwner:role==="admin"?T.roleAdmin:T.roleUser; }
function safeFileName(name){ return name.replace(/[^\w.\-]+/g,"_"); }
function Avatar({url, small=false, big=false}){ return <div className={`avatar ${small?"small":""} ${big?"big":""}`}>{url?<img src={url} alt="avatar"/>:null}</div>; }
function Pill({children, tone=""}){ return <span className={`pill ${tone}`}>{children}</span>; }

export default function Page(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [profiles,setProfiles]=useState([]);
  const [posts,setPosts]=useState([]);
  const [comments,setComments]=useState([]);
  const [friends,setFriends]=useState([]);
  const [messages,setMessages]=useState([]);
  const [likes,setLikes]=useState([]);
  const [groups,setGroups]=useState([]);
  const [tab,setTab]=useState("wall");
  const [notice,setNotice]=useState("");
  const [auth,setAuth]=useState({email:"",password:"",displayName:"",realName:"",year:"Year 11",avatar:null});
  const [post,setPost]=useState({target:"",body:"",anonymous:true,image:null});
  const [commentText,setCommentText]=useState({});
  const [query,setQuery]=useState("");
  const [friendId,setFriendId]=useState("");
  const [selectedChat,setSelectedChat]=useState("");
  const [chatOpen,setChatOpen]=useState(false);
  const [sharePost,setSharePost]=useState(null);
  const [viewProfile,setViewProfile]=useState(null);
  const [groupName,setGroupName]=useState("");
  const [edit,setEdit]=useState({displayName:"",avatar:null,bg:null});
  const chatRef=useRef(null);

  const isOwner=profile?.role==="owner";
  const isManager=profile?.role==="owner"||profile?.role==="admin";

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ setSession(data.session); if(data.session) boot(data.session.user.id); });
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{ setSession(s); if(s) boot(s.user.id); else setProfile(null); });
    return()=>sub.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session) return;
    const ch=supabase.channel("gwsc-v3")
      .on("postgres_changes",{event:"*",schema:"public",table:"posts"},loadPosts)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments"},loadComments)
      .on("postgres_changes",{event:"*",schema:"public",table:"friendships"},loadFriends)
      .on("postgres_changes",{event:"*",schema:"public",table:"private_messages"},loadMessages)
      .on("postgres_changes",{event:"*",schema:"public",table:"post_likes"},loadLikes)
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[session]);

  async function boot(uid){ await loadProfile(uid); await Promise.all([loadProfiles(),loadPosts(),loadComments(),loadFriends(),loadMessages(),loadLikes(),loadGroups()]); }
  async function loadProfile(uid=session?.user?.id){ if(!uid)return; const {data}=await supabase.from("profiles").select("*").eq("id",uid).single(); if(data){setProfile(data);setEdit({displayName:data.display_name||"",avatar:null,bg:null});}}
  async function loadProfiles(){ const {data}=await supabase.from("profiles").select("*").order("created_at"); if(data)setProfiles(data); }
  async function loadPosts(){ const {data}=await supabase.from("posts").select("*").neq("status","deleted").order("created_at",{ascending:false}); if(data)setPosts(data); }
  async function loadComments(){ const {data}=await supabase.from("comments").select("*").order("created_at"); if(data)setComments(data); }
  async function loadFriends(){ const {data}=await supabase.from("friendships").select("*"); if(data)setFriends(data); }
  async function loadMessages(){ const {data}=await supabase.from("private_messages").select("*").order("created_at"); if(data)setMessages(data); }
  async function loadLikes(){ const {data}=await supabase.from("post_likes").select("*"); if(data)setLikes(data); }
  async function loadGroups(){ const {data}=await supabase.from("groups").select("*").order("created_at",{ascending:false}); if(data)setGroups(data); }

  async function upload(bucket,file){
    const uid=profile?.id||session?.user?.id;
    if(!file||!uid)return null;
    const path=`${uid}/${Date.now()}-${safeFileName(file.name)}`;
    const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false});
    if(error)throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  async function getNextId(){ const {data,error}=await supabase.rpc("next_numeric_id"); return error ? String(Date.now()).slice(-6) : data; }

  async function signUp(){
    setNotice("");
    if(!auth.email||!auth.password||!auth.displayName||!auth.realName||!auth.year) return setNotice("信息要填完整。");
    const {data,error}=await supabase.auth.signUp({
      email:auth.email,
      password:auth.password,
      options:{data:{display_name:auth.displayName,real_name:auth.realName,year_level:auth.year}}
    });
    if(error) return setNotice(error.message);
    if(!data.user) return setNotice("请先去邮箱确认。");
    if(!data.session) return setNotice("注册成功，请先去邮箱确认，然后回来登录。");
    try{
      const avatar_url=auth.avatar?await uploadFileAs(data.user.id,"avatars",auth.avatar):null;
      if(avatar_url){
        const {error:pe}=await supabase.from("profiles").update({avatar_url}).eq("id",data.user.id);
        if(pe)return setNotice(pe.message);
      }
    }catch(error){
      return setNotice(error.message||"头像上传失败，请登录后在我的页面重新上传。");
    }
    boot(data.user.id);
  }
  async function uploadFileAs(uid,bucket,file){ const path=`${uid}/${Date.now()}-${safeFileName(file.name)}`; const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false}); if(error)throw error; return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl; }
  async function signIn(){ const {error}=await supabase.auth.signInWithPassword({email:auth.email,password:auth.password}); if(error)setNotice(error.message); }
  async function signOut(){ await supabase.auth.signOut(); }

  const myFriendIds=useMemo(()=>{ const s=new Set(); friends.forEach(f=>{if(f.user_id===profile?.id)s.add(f.friend_id); if(f.friend_id===profile?.id)s.add(f.user_id);}); return [...s];},[friends,profile]);
  const friendProfiles=profiles.filter(p=>myFriendIds.includes(p.id));
  const publicAdmins=profiles.filter(p=>p.role==="owner"||p.role==="admin");
  const commentCount=comments.filter(c=>c.author_id===profile?.id).length;
  const free=20+(profile?.extra_comments||0);
  const payment=Math.max(0,Math.ceil((commentCount-free)/5)*3);
  const visiblePosts=posts.filter(p=>isManager||p.status==="approved"||p.author_id===profile?.id).filter(p=>`${p.body} ${p.target} ${p.public_author_name}`.toLowerCase().includes(query.toLowerCase()));

  async function submitPost(){
    if(!post.body.trim()) return;
    try{
      const image_url=post.image?await upload("post-images",post.image):null;
      const {error}=await supabase.rpc("create_post",{
        p_target:post.target,
        p_body:post.body,
        p_anonymous:post.anonymous,
        p_image_url:image_url
      });
      if(error)return setNotice(error.message);
      setPost({target:"",body:"",anonymous:true,image:null});
      setNotice("已提交审核。");
      loadPosts();
    }catch(error){
      setNotice(error.message||"投稿失败。");
    }
  }
  async function approve(id){ await supabase.from("posts").update({status:"approved"}).eq("id",id); loadPosts(); }
  async function delPost(id){ await supabase.from("posts").update({status:"deleted"}).eq("id",id); loadPosts(); }
  async function like(p){ const ex=likes.find(l=>l.post_id===p.id&&l.user_id===profile.id); if(ex){await supabase.from("post_likes").delete().eq("id",ex.id); await supabase.from("posts").update({likes:Math.max(0,p.likes-1)}).eq("id",p.id);}else{await supabase.from("post_likes").insert({post_id:p.id,user_id:profile.id}); await supabase.from("posts").update({likes:(p.likes||0)+1}).eq("id",p.id);} loadLikes();loadPosts(); }
  async function addComment(pid){ const body=(commentText[pid]||"").trim(); if(!body)return; if(commentCount>=free)setNotice(T.commentLimit); const {error}=await supabase.from("comments").insert({post_id:pid,author_id:profile.id,body}); if(error)setNotice(error.message); else {setCommentText({...commentText,[pid]:""});loadComments();}}
  async function delComment(id){ await supabase.from("comments").delete().eq("id",id); loadComments(); }

  async function addFriendById(id=friendId){
    const target=profiles.find(p=>p.numeric_id===id.trim());
    if(!target||target.id===profile.id) return setNotice("没有找到这个数字 ID。");
    const exists=friends.some(f=>(f.user_id===profile.id&&f.friend_id===target.id)||(f.user_id===target.id&&f.friend_id===profile.id));
    if(!exists){
      const {error}=await supabase.from("friendships").insert({user_id:profile.id,friend_id:target.id});
      if(error)return setNotice(error.message);
    }
    setSelectedChat(target.id); setChatOpen(true); setFriendId(""); await loadFriends();
  }
  async function sendMessage({receiver=selectedChat,body=null,postId=null,profileId=null,game=null,groupId=null}={}){
    const text=body??chatRef.current?.value?.trim();
    if(!text&&!postId&&!profileId&&!game)return;
    if(!groupId&&!receiver)return setNotice("请先选择一个聊天对象。");
    const {error}=await supabase.rpc("send_private_message",{
      p_receiver_id:groupId?null:receiver,
      p_body:text||"",
      p_shared_post_id:postId||null,
      p_shared_profile_id:profileId||null,
      p_game_invite:game||null,
      p_group_id:groupId||null
    });
    if(error)return setNotice(error.message);
    if(chatRef.current&&!body)chatRef.current.value="";
    setNotice("");
    await loadMessages();
  }
  async function shareToFriend(fid,p){ await sendMessage({receiver:fid,body:"转发了一条表白墙内容",postId:p.id}); await supabase.from("posts").update({share_count:(p.share_count||0)+1}).eq("id",p.id); setSharePost(null); loadPosts(); }
  async function recommendFriend(toId,friend){ await sendMessage({receiver:toId,body:`推荐好友：${friend.display_name}，数字ID：${friend.numeric_id}`,profileId:friend.id}); }

  async function saveProfile(){
    try{
      const avatar_url=edit.avatar?await upload("avatars",edit.avatar):profile.avatar_url;
      const background_url=edit.bg?await upload("backgrounds",edit.bg):profile.background_url;
      const {error}=await supabase.from("profiles").update({display_name:edit.displayName,avatar_url,background_url}).eq("id",profile.id);
      if(error)return setNotice(error.message);
      setNotice("资料已保存。");
      await boot(profile.id);
    }catch(error){
      setNotice(error.message||"资料保存失败。");
    }
  }
  async function ownerSetNumericId(u,newId){
    if(!isOwner)return;
    const {error}=await supabase.rpc("owner_set_numeric_id",{p_user_id:u.id,p_numeric_id:newId});
    if(error)return setNotice(error.message);
    setNotice("数字 ID 已更新。");
    loadProfiles();
  }
  async function setRole(u,role){ if(!isOwner)return; await supabase.from("profiles").update({role}).eq("id",u.id); loadProfiles(); }
  async function block(u,b=!u.blocked){ if(u.role==="owner")return setNotice("管理员不能踢群主。"); await supabase.from("profiles").update({blocked:b}).eq("id",u.id); loadProfiles(); }
  async function bonus(u){ await supabase.from("profiles").update({extra_comments:(u.extra_comments||0)+1}).eq("id",u.id); loadProfiles(); }
  async function createGroup(){ if(!groupName.trim())return; const {data}=await supabase.from("groups").insert({name:groupName,owner_id:profile.id}).select().single(); if(data){await supabase.from("group_members").insert({group_id:data.id,user_id:profile.id}); setGroupName(""); loadGroups();}}

  if(!session||!profile) return <main className="loginScreen"><section className="loginBox card pad stack">
    <div className="between"><div><h1>{T.loginTitle}</h1><p className="sub">{T.loginSub}</p></div></div>
    <div className="tip">{T.ruleTip}</div>
    <div className="form2">
      <input placeholder={T.email} value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})}/>
      <input placeholder={T.password} type="password" value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})}/>
      <input placeholder={T.displayName} value={auth.displayName} onChange={e=>setAuth({...auth,displayName:e.target.value})}/>
      <input placeholder={T.realName} value={auth.realName} onChange={e=>setAuth({...auth,realName:e.target.value})}/>
      <input placeholder={T.yearLevel} value={auth.year} onChange={e=>setAuth({...auth,year:e.target.value})}/>
      <label className="soft row" style={{cursor:"pointer",justifyContent:"center"}}><Camera size={16}/>{T.changeAvatar}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>setAuth({...auth,avatar:e.target.files?.[0]})}/></label>
    </div>
    <div className="notice"><Shield size={16}/>{T.privacy}</div>{notice&&<p className="error">{notice}</p>}
    <div className="tabs"><button onClick={signUp}>{T.signUp}</button><button className="secondary" onClick={signIn}>{T.signIn}</button></div>
  </section></main>;

  const selected=profiles.find(p=>p.id===selectedChat);
  const selectedMessages=messages.filter(m=>(m.sender_id===profile.id&&m.receiver_id===selectedChat)||(m.sender_id===selectedChat&&m.receiver_id===profile.id));

  return <>
    <header><div className="topbar"><div className="brand"><div className="logo"><Sparkles/></div><div><h1>{T.title}</h1><p className="sub">{T.subtitle}</p></div></div><div className="tabs"><button className="secondary" onClick={signOut}>{T.signOut}</button></div></div></header>
    <main className="wrap">
      {tab==="wall"&&<div className="grid">
        <aside className="stack">
          <section className="card pad stack"><div className="row"><Avatar url={profile.avatar_url}/><div><h3>{profile.display_name}</h3><p className="mini">ID: {profile.numeric_id}</p></div></div><div className="tabs"><Pill tone={profile.role==="owner"?"yellow":profile.role==="admin"?"green":""}>{roleText(profile.role)}</Pill><Pill tone="pink">{commentCount}/{free} 评论</Pill>{payment>0&&<Pill tone="yellow">需转 {payment} 元</Pill>}</div><div className="notice">{T.privacy}</div></section>
          <section className="card pad stack"><h2>{T.publicAdmins}</h2>{publicAdmins.map(u=><div className="friend between" key={u.id}><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id}</div></div></div><Pill tone={u.role==="owner"?"yellow":"green"}>{roleText(u.role)}</Pill></div>)}</section>
          {isManager&&<section className="card pad stack"><h2>{isOwner?T.ownerPanel:T.adminPanel}</h2>{profiles.map(u=><div className="userRow stack" key={u.id}><div className="between"><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">{isOwner?`${u.real_name} · ${u.year_level} · `:""}ID: {u.numeric_id}</div></div></div><Pill tone={u.role==="owner"?"yellow":u.role==="admin"?"green":""}>{roleText(u.role)}</Pill></div><div className="tabs">{isOwner&&u.role==="user"&&<button className="secondary" onClick={()=>setRole(u,"admin")}>{T.makeAdmin}</button>}{isOwner&&u.role==="admin"&&<button className="secondary" onClick={()=>setRole(u,"user")}>{T.removeAdmin}</button>}{isOwner&&u.id!==profile.id&&<button className="secondary" onClick={()=>setRole(u,"owner")}>{T.transferOwner}</button>}{isOwner&&<button className="secondary" onClick={()=>{const v=prompt("新数字 ID",u.numeric_id); if(v)ownerSetNumericId(u,v)}}>{T.setUserId}</button>}<button className="secondary" onClick={()=>bonus(u)}>{T.bonus}</button>{u.role!=="owner"&&<button className="secondary" onClick={()=>block(u)}>{u.blocked?T.unblock:T.block}</button>}</div></div>)}</section>}
        </aside>
        <section className="stack">
          <section className="card pad stack"><div className="tip">{T.ruleTip}</div><div className="between"><h2>{T.submitPost}</h2><Pill tone="yellow">{T.commentRule}</Pill></div><input placeholder={T.receiver} value={post.target} onChange={e=>setPost({...post,target:e.target.value})}/><textarea placeholder={T.placeholder} value={post.body} onChange={e=>setPost({...post,body:e.target.value})}/><div className="between"><label className="row"><input style={{width:"auto"}} type="checkbox" checked={post.anonymous} onChange={e=>setPost({...post,anonymous:e.target.checked})}/>{T.postAnon}</label><label className="soft row" style={{cursor:"pointer"}}><ImageIcon size={16}/>{T.addPhoto}<input style={{display:"none"}} type="file" accept="image/*" onChange={e=>setPost({...post,image:e.target.files?.[0]})}/></label><button onClick={submitPost}><Send size={16}/>{T.sendToReview}</button></div>{notice&&<div className="soft error">{notice}</div>}</section>
          <div className="between"><h2>表白动态</h2><div className="search"><Search size={16}/><input placeholder="搜索内容" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
          {visiblePosts.length===0?<div className="card empty">{T.empty}</div>:visiblePosts.map(p=>{const author=profiles.find(u=>u.id===p.author_id);const pcs=comments.filter(c=>c.post_id===p.id);const liked=likes.some(l=>l.post_id===p.id&&l.user_id===profile.id);return <article className="card" key={p.id}><div className="postHead"><div className="between"><div className="row"><Avatar url={p.anonymous?null:p.public_author_avatar}/><div><div className="row" style={{flexWrap:"wrap"}}>{p.anonymous?<b>Anonymous</b>:<b className="clickable" onClick={()=>setViewProfile(author)}>{p.public_author_name}</b>}<Pill tone={p.status==="approved"?"green":"yellow"}>{p.status==="approved"?T.approved:T.pending}</Pill>{p.target&&<Pill>to: {p.target}</Pill>}</div><div className="mini">{new Date(p.created_at).toLocaleString()} · {T.realHidden}</div></div></div></div><div className="postBody">{p.body}</div>{p.image_url&&<img className="postImage" src={p.image_url}/>}<div className="tabs" style={{marginTop:15}}><button className={liked?"":"secondary"} onClick={()=>like(p)}><Heart size={16}/>{T.like} {p.likes}</button><button className="secondary" onClick={()=>setSharePost(p)}><Share2 size={16}/>{T.share} {p.share_count||0}</button><Pill><MessageCircle size={14}/>{pcs.length} 评论</Pill></div></div><div className="pad stack">{pcs.map(c=>{const cu=profiles.find(u=>u.id===c.author_id);return <div className="comment" key={c.id}><div className="row" style={{alignItems:"flex-start"}}><Avatar url={cu?.avatar_url} small/><div><b>{cu?.display_name}</b><div>{c.body}</div></div></div>{isManager&&<button className="secondary" onClick={()=>delComment(c.id)}>🗑️</button>}</div>})}<div className="commentForm"><input placeholder={T.addComment} value={commentText[p.id]||""} onChange={e=>setCommentText({...commentText,[p.id]:e.target.value})}/><button onClick={()=>addComment(p.id)}>➤</button></div>{isManager&&<div className="adminStrip">{p.status==="pending"&&<button className="good" onClick={()=>approve(p.id)}>✓ {T.approve}</button>}<button className="danger" onClick={()=>delPost(p.id)}>{T.delete}</button>{!p.anonymous&&author&&<button className="warn" onClick={()=>block(author)}>{T.block}</button>}{isOwner&&p.anonymous&&author&&<span className="real">匿名作者：{author.real_name} · {author.year_level}</span>}{isOwner&&!p.anonymous&&author&&<span className="real">Real: {author.real_name} · {author.year_level}</span>}</div>}</div></article>})}
        </section>
      </div>}

      {tab==="chats"&&<section className="stack"><div className="card pad stack"><div className="tip">{T.onlyId}</div><div className="between"><h2>{T.chats}</h2><div className="row" style={{maxWidth:520,flex:1}}><input placeholder={T.addById} value={friendId} onChange={e=>setFriendId(e.target.value.replace(/\D/g,""))}/><button onClick={()=>addFriendById()}><UserPlus size={16}/>{T.addFriend}</button></div></div><div className="row"><input placeholder={T.groupName} value={groupName} onChange={e=>setGroupName(e.target.value)}/><button onClick={createGroup}><Users size={16}/>{T.createGroup}</button></div>{notice&&<p className="error">{notice}</p>}</div><div className="card pad stack"><h2>{T.friends}</h2>{friendProfiles.map(u=><div className="chatRow between" key={u.id}><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id} · {roleText(u.role)}</div></div></div><div className="tabs"><button onClick={()=>{setSelectedChat(u.id);setChatOpen(true)}}>{T.openChat}</button><button className="secondary" onClick={()=>sendMessage({receiver:u.id,body:"邀请你玩五子棋",game:"gomoku"})}><Gamepad2 size={16}/>五子棋</button><button className="secondary" onClick={()=>sendMessage({receiver:u.id,body:"邀请你玩 Chess",game:"chess"})}>Chess</button></div></div>)}</div></section>}

      {tab==="mine"&&<section className="profileGrid"><div className="card"><div className="profileHero" style={{backgroundImage:`url(${profile.background_url||""})`}}></div><div className="pad stack"><div className="row"><Avatar url={profile.avatar_url} big/><div><h2>{profile.display_name}</h2><p className="mini">ID: {profile.numeric_id}</p><Pill tone={profile.role==="owner"?"yellow":profile.role==="admin"?"green":""}>{roleText(profile.role)}</Pill></div></div><button onClick={()=>setViewProfile(profile)}><IdCard size={16}/>{T.shareCard}</button><div className="soft">{T.commentRule}<br/><span className="mini">Used: {commentCount}/{free} {payment>0?`需转 ${payment} 元`:""}</span></div></div></div><div className="card pad stack"><h2><Settings size={20}/>{T.mine}</h2><input value={edit.displayName} onChange={e=>setEdit({...edit,displayName:e.target.value})}/><label className="soft row" style={{cursor:"pointer",justifyContent:"center"}}><Camera size={16}/>{T.changeAvatar}<input style={{display:"none"}} type="file" accept="image/*" onChange={e=>setEdit({...edit,avatar:e.target.files?.[0]})}/></label><label className="soft row" style={{cursor:"pointer",justifyContent:"center"}}><ImageIcon size={16}/>{T.changeBg}<input style={{display:"none"}} type="file" accept="image/*" onChange={e=>setEdit({...edit,bg:e.target.files?.[0]})}/></label><button onClick={saveProfile}>{T.saveProfile}</button>{notice&&<p className="error">{notice}</p>}</div></section>}
    </main>

    <nav className="bottomNav"><button className={tab==="wall"?"active":""} onClick={()=>setTab("wall")}><Home size={16}/>{T.wall}</button><button className={tab==="chats"?"active":""} onClick={()=>setTab("chats")}><MessageCircle size={16}/>{T.chats}</button><button className={tab==="mine"?"active":""} onClick={()=>setTab("mine")}><User size={16}/>{T.mine}</button></nav>

    {chatOpen&&selected&&<div className="modalBg"><div className="modal"><div className="chatWindow"><div className="chatHeader between"><div className="row"><Avatar url={selected.avatar_url} small/><div><b>{selected.display_name}</b><div className="mini" style={{color:"rgba(255,255,255,.7)"}}>ID: {selected.numeric_id}</div></div></div><button className="ghost" style={{color:"white"}} onClick={()=>setChatOpen(false)}><X size={18}/></button></div><div className="chatBox">{selectedMessages.map(m=>{const sp=posts.find(p=>p.id===m.shared_post_id);const su=profiles.find(p=>p.id===m.shared_profile_id);return <div className={`bubble ${m.sender_id===profile.id?"me":"them"}`} key={m.id}><div>{m.body}</div>{m.game_invite&&<div className="sharedCard">🎮 游戏邀请：{m.game_invite==="gomoku"?"五子棋":"Chess"}</div>}{sp&&<div className="sharedCard"><b>{sp.anonymous?"Anonymous":sp.public_author_name}</b><div className="mini">{sp.body.slice(0,90)}...</div>{sp.image_url&&<img src={sp.image_url} style={{width:"100%",borderRadius:12,marginTop:8}}/>}</div>}{su&&<div className="sharedCard"><b>{su.display_name}</b><div className="mini">推荐名片 ID: {su.numeric_id}</div></div>}</div>})}</div><div className="pad commentForm"><input ref={chatRef} placeholder={T.message}/><button onClick={()=>sendMessage()}><Send size={16}/></button></div></div></div></div>}

    {sharePost&&<div className="modalBg"><div className="modal stack"><div className="between"><h2>{T.shareToFriend}</h2><button className="ghost" onClick={()=>setSharePost(null)}><X size={18}/></button></div>{friendProfiles.map(u=><div className="friend between" key={u.id}><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id}</div></div></div><button onClick={()=>shareToFriend(u.id,sharePost)}><Share2 size={16}/>{T.share}</button></div>)}</div></div>}

    {viewProfile&&<div className="modalBg"><div className="modal stack"><div className="between"><h2>{T.profile}</h2><button className="ghost" onClick={()=>setViewProfile(null)}><X size={18}/></button></div><div className="card"><div className="profileHero" style={{backgroundImage:`url(${viewProfile.background_url||""})`}}></div><div className="pad row"><Avatar url={viewProfile.avatar_url} big/><div><h2>{viewProfile.display_name}</h2><p className="mini">ID: {viewProfile.numeric_id}</p><Pill tone={viewProfile.role==="owner"?"yellow":viewProfile.role==="admin"?"green":""}>{roleText(viewProfile.role)}</Pill></div></div></div><div className="tabs">{viewProfile.id!==profile.id&&<button onClick={()=>addFriendById(viewProfile.numeric_id)}>{T.addFriend}</button>}{friendProfiles.map(f=><button className="secondary" key={f.id} onClick={()=>recommendFriend(f.id,viewProfile)}>{T.recommendFriend}给 {f.display_name}</button>)}</div></div></div>}
  </>;
}
