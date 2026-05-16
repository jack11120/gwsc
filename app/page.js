"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Heart, Send, Shield, Crown, Sparkles, MessageCircle, UserPlus, Search,
  Home, User, Image as ImageIcon, Share2, Settings, Camera, X, Gamepad2,
  Users, IdCard, Swords, CircleDot
} from "lucide-react";

const T = {
  title:"GWSC 表白墙 V4", subtitle:"匿名浏览 · 实名投稿 · 学生专属的轻松小角落",
  wall:"表白墙", chats:"私聊", mine:"我的", games:"游戏",
  email:"邮箱", password:"密码，至少 6 位", loginTitle:"登录 / 注册",
  loginSub:"注册时必须填写真实姓名和年级。别人看不到，只有群主/管理员审核时能看到。",
  displayName:"昵称", realName:"真实姓名", yearLevel:"年级", signUp:"注册", signIn:"登录", signOut:"退出",
  ruleTip:"可以投稿，但内容要经过审核员通过后才会公开。请礼貌发言，不要攻击别人，不要泄露他人隐私。",
  privacy:"管理者不会泄露你的真实姓名和年级。匿名帖只有群主可查看真实作者，管理员不会显示匿名作者。",
  submitPost:"投稿", receiver:"想投稿给谁？可不填", placeholder:"写点想说的话……可以表白、感谢、道歉、夸人，但不要攻击别人。",
  postAnon:"这条公开匿名", addPhoto:"添加照片", sendToReview:"提交审核", pending:"待审核", approved:"已通过",
  comments:"评论", addComment:"写评论……", commentRule:"评论不限次数，请友善发言。",
  publicAdmins:"公开管理员", ownerPanel:"群主控制台", adminPanel:"管理后台", approve:"通过", delete:"删帖", block:"拉黑", unblock:"解除拉黑",
  makeAdmin:"设为管理员", removeAdmin:"取消管理员", transferOwner:"移交群主", setUserId:"改用户 ID",
  friends:"好友", addById:"输入好友数字 ID 添加", addFriend:"加好友", openChat:"打开私聊", message:"输入私聊消息……",
  onlyId:"只能通过搜索数字 ID 加好友。表白墙匿名帖不能点主页；非匿名帖可以点主页并加好友。",
  like:"点赞", share:"转发", shareToFriend:"转发给好友", recommendFriend:"推荐好友", shareCard:"分享名片",
  profile:"个人主页", saveProfile:"保存资料", changeAvatar:"更改头像", changeBg:"更改主页背景", numericId:"数字 ID",
  roleOwner:"群主", roleAdmin:"管理员", roleUser:"普通用户", realHidden:"实名信息已隐藏，仅管理者可见",
  createGroup:"拉多人群", groupName:"群聊名称", inviteGomoku:"邀请五子棋", inviteChess:"邀请 Chess", empty:"还没有内容，先投一条吧。",
  gameCenter:"游戏中心", activeGames:"我的游戏", gomoku:"五子棋", chess:"Chess", openGame:"打开游戏", yourTurn:"轮到你了", notYourTurn:"等待对方", gameOver:"游戏结束",
  simplifiedChess:"简化 Chess：支持移动棋子和回合制，不含完整将军/将死规则。"
};

function roleText(role){ return role==="owner"?T.roleOwner:role==="admin"?T.roleAdmin:T.roleUser; }
function Avatar({url, small=false, big=false}){ return <div className={`avatar ${small?"small":""} ${big?"big":""}`}>{url?<img src={url} alt="avatar"/>:null}</div>; }
function Pill({children, tone=""}){ return <span className={`pill ${tone}`}>{children}</span>; }

const emptyGomoku = () => Array.from({length:15},()=>Array(15).fill(null));
const initialChess = () => ([
  ["br","bn","bb","bq","bk","bb","bn","br"],
  ["bp","bp","bp","bp","bp","bp","bp","bp"],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ["wp","wp","wp","wp","wp","wp","wp","wp"],
  ["wr","wn","wb","wq","wk","wb","wn","wr"],
]);
const chessIcon = {wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
function normalizeGomokuBoard(board){ return Array.isArray(board)&&board.length===15&&board.every(row=>Array.isArray(row)&&row.length===15)?board:emptyGomoku(); }
function normalizeChessBoard(board){ return Array.isArray(board)&&board.length===8&&board.every(row=>Array.isArray(row)&&row.length===8)?board:initialChess(); }

function checkGomokuWin(board,r,c,player){
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for(const [dr,dc] of dirs){
    let count=1;
    for(const sign of [1,-1]){
      let nr=r+dr*sign,nc=c+dc*sign;
      while(nr>=0&&nr<15&&nc>=0&&nc<15&&board[nr][nc]===player){ count++; nr+=dr*sign; nc+=dc*sign; }
    }
    if(count>=5) return true;
  }
  return false;
}

function legalChessMove(board, from, to, turnColor){
  if(!from || !to) return false;
  const [fr,fc]=from, [tr,tc]=to;
  if(fr===tr&&fc===tc) return false;
  const piece=board[fr][fc]; if(!piece) return false;
  const color=piece[0], type=piece[1]; if(color!==turnColor) return false;
  const target=board[tr][tc]; if(target && target[0]===color) return false;
  const dr=tr-fr, dc=tc-fc, adr=Math.abs(dr), adc=Math.abs(dc);
  const clearLine=()=>{
    const sr=Math.sign(dr), sc=Math.sign(dc); let r=fr+sr,c=fc+sc;
    while(r!==tr||c!==tc){ if(board[r][c]) return false; r+=sr; c+=sc; }
    return true;
  };
  if(type==="p"){
    const dir=color==="w"?-1:1, start=color==="w"?6:1;
    if(dc===0&&!target&&dr===dir) return true;
    if(dc===0&&!target&&fr===start&&dr===2*dir&&!board[fr+dir][fc]) return true;
    if(adc===1&&dr===dir&&target&&target[0]!==color) return true;
    return false;
  }
  if(type==="r") return (dr===0||dc===0)&&clearLine();
  if(type==="b") return adr===adc&&clearLine();
  if(type==="q") return ((dr===0||dc===0)||adr===adc)&&clearLine();
  if(type==="k") return adr<=1&&adc<=1;
  if(type==="n") return (adr===2&&adc===1)||(adr===1&&adc===2);
  return false;
}

export default function Page(){
  const [session,setSession]=useState(null), [profile,setProfile]=useState(null);
  const [profiles,setProfiles]=useState([]), [posts,setPosts]=useState([]), [comments,setComments]=useState([]);
  const [friends,setFriends]=useState([]), [messages,setMessages]=useState([]), [likes,setLikes]=useState([]);
  const [groups,setGroups]=useState([]), [games,setGames]=useState([]), [moves,setMoves]=useState([]);
  const [tab,setTab]=useState("wall"), [notice,setNotice]=useState("");
  const [auth,setAuth]=useState({email:"",password:"",displayName:"",realName:"",year:"Year 11",avatar:null});
  const [post,setPost]=useState({target:"",body:"",anonymous:true,image:null});
  const [commentText,setCommentText]=useState({}), [query,setQuery]=useState(""), [friendId,setFriendId]=useState("");
  const [selectedChat,setSelectedChat]=useState(""), [chatOpen,setChatOpen]=useState(false), [sharePost,setSharePost]=useState(null);
  const [viewProfile,setViewProfile]=useState(null), [groupName,setGroupName]=useState("");
  const [edit,setEdit]=useState({displayName:"",avatar:null,bg:null});
  const [activeGame,setActiveGame]=useState(null), [selectedChess,setSelectedChess]=useState(null);
  const chatRef=useRef(null);

  const isOwner=profile?.role==="owner", isManager=profile?.role==="owner"||profile?.role==="admin";

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ setSession(data.session); if(data.session) boot(data.session.user.id); });
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{ setSession(s); if(s) boot(s.user.id); else setProfile(null); });
    return()=>sub.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session) return;
    const ch=supabase.channel("gwsc-v4")
      .on("postgres_changes",{event:"*",schema:"public",table:"comments"},loadComments)
      .on("postgres_changes",{event:"*",schema:"public",table:"friendships"},loadFriends)
      .on("postgres_changes",{event:"*",schema:"public",table:"private_messages"},loadMessages)
      .on("postgres_changes",{event:"*",schema:"public",table:"post_likes"},loadLikes)
      .on("postgres_changes",{event:"*",schema:"public",table:"game_sessions"},loadGames)
      .on("postgres_changes",{event:"*",schema:"public",table:"game_moves"},loadMoves)
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[session]);

  async function boot(uid){ await loadProfile(uid); await Promise.all([loadProfiles(),loadPosts(),loadComments(),loadFriends(),loadMessages(),loadLikes(),loadGroups(),loadGames(),loadMoves()]); }
  async function loadProfile(uid=session?.user?.id){ if(!uid)return; const {data}=await supabase.from("profiles").select("*").eq("id",uid).single(); if(data){setProfile(data);setEdit({displayName:data.display_name||"",avatar:null,bg:null});}}
  async function loadProfiles(){ 
    const {data}=await supabase.from("public_profiles_view").select("*").order("created_at"); 
    if(data)setProfiles(data); 
  }
  async function loadPosts(){ 
    let data=null;
    if(isOwner){ const r=await supabase.from("owner_posts_view").select("*").order("created_at",{ascending:false}); data=r.data; }
    else if(isManager){ const r=await supabase.from("admin_posts_view").select("*").order("created_at",{ascending:false}); data=r.data; }
    else { const r=await supabase.from("public_posts_view").select("*").order("created_at",{ascending:false}); data=r.data; }
    if(data)setPosts(data); 
  }
  useEffect(()=>{ if(profile) loadPosts(); },[profile?.role]);

  async function loadComments(){ const {data}=await supabase.from("comments").select("*").order("created_at"); if(data)setComments(data); }
  async function loadFriends(){ const {data}=await supabase.from("friendships").select("*"); if(data)setFriends(data); }
  async function loadMessages(){ const {data}=await supabase.from("private_messages").select("*").order("created_at"); if(data)setMessages(data); }
  async function loadLikes(){ const {data}=await supabase.from("post_likes").select("*"); if(data)setLikes(data); }
  async function loadGroups(){ const {data}=await supabase.from("groups").select("*").order("created_at",{ascending:false}); if(data)setGroups(data); }
  async function loadGames(){ const {data}=await supabase.from("game_sessions").select("*").order("updated_at",{ascending:false}); if(data)setGames(data); }
  async function loadMoves(){ const {data}=await supabase.from("game_moves").select("*").order("move_no"); if(data)setMoves(data); }

  async function upload(bucket,file){ if(!file)return null; const uid=profile?.id||session?.user?.id; const path=`${uid}/${Date.now()}-${file.name}`; const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:true}); if(error)throw error; return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl; }
  async function signUp(){
    setNotice(""); if(!auth.email||!auth.password||!auth.displayName||!auth.realName||!auth.year) return setNotice("信息要填完整。");
    const {data,error}=await supabase.auth.signUp({email:auth.email,password:auth.password});
    if(error) return setNotice(error.message); if(!data.user) return setNotice("请先去邮箱确认。");
    const avatar_url=auth.avatar?await uploadFileAs(data.user.id,"avatars",auth.avatar):null;
    const {data:idData}=await supabase.rpc("next_numeric_id");
    const {error:pe}=await supabase.from("profiles").insert({id:data.user.id,email:auth.email,display_name:auth.displayName,real_name:auth.realName,year_level:auth.year,numeric_id:idData,avatar_url,role:"user"});
    if(pe)setNotice(pe.message); else boot(data.user.id);
  }
  async function uploadFileAs(uid,bucket,file){ const path=`${uid}/${Date.now()}-${file.name}`; const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:true}); if(error)throw error; return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl; }
  async function signIn(){ const {error}=await supabase.auth.signInWithPassword({email:auth.email,password:auth.password}); if(error)setNotice(error.message); }
  async function signOut(){ await supabase.auth.signOut(); }

  const myFriendIds=useMemo(()=>{ const s=new Set(); friends.forEach(f=>{if(f.user_id===profile?.id)s.add(f.friend_id); if(f.friend_id===profile?.id)s.add(f.user_id);}); return [...s];},[friends,profile]);
  const friendProfiles=profiles.filter(p=>myFriendIds.includes(p.id));
  const publicAdmins=profiles.filter(p=>p.role==="owner"||p.role==="admin");
  const commentCount=comments.filter(c=>c.author_id===profile?.id).length;
  const visiblePosts=posts.filter(p=>`${p.body||""} ${p.target||""} ${p.public_author_name||""}`.toLowerCase().includes(query.toLowerCase()));

  async function submitPost(){
    if(!post.body.trim()) return;
    const image_url=post.image?await upload("post-images",post.image):null;
    const {error}=await supabase.rpc("create_post",{p_target:post.target,p_body:post.body,p_anonymous:post.anonymous,p_image_url:image_url});
    if(error)setNotice(error.message); else {setPost({target:"",body:"",anonymous:true,image:null});setNotice("已提交审核。");loadPosts();}
  }
  async function moderatePost(p,status){ const {error}=await supabase.rpc("moderate_post",{p_post_id:p.id,p_status:status}); if(error)setNotice(error.message); else loadPosts(); }
  async function approve(p){ await moderatePost(p,"approved"); }
  async function delPost(p){ await moderatePost(p,"deleted"); }
  async function like(p){ const {error}=await supabase.rpc("toggle_like",{p_post_id:p.id}); if(error)setNotice(error.message); else {loadLikes();loadPosts();} }
  async function addComment(pid){ const body=(commentText[pid]||"").trim(); if(!body)return; const {data,error}=await supabase.rpc("create_comment",{p_post_id:pid,p_body:body}); if(error)setNotice(error.message); else {setNotice(data?.message||"评论成功。");setCommentText({...commentText,[pid]:""});loadComments();}}
  async function delComment(id){ await supabase.from("comments").delete().eq("id",id); loadComments(); }

  async function addFriendById(id=friendId){
    const {data,error}=await supabase.rpc("add_friend_by_numeric_id",{p_numeric_id:id.trim()});
    if(error)return setNotice(error.message);
    setSelectedChat(data.id); setChatOpen(true); setFriendId(""); loadFriends(); loadProfiles();
  }
  async function sendMessage({receiver=selectedChat,body=null,postId=null,profileId=null,game=null,groupId=null}={}){
    const text=body??chatRef.current?.value?.trim();
    const {error}=await supabase.rpc("send_private_message",{p_receiver_id:receiver||null,p_body:text||"",p_shared_post_id:postId,p_shared_profile_id:profileId,p_game_invite:game,p_group_id:groupId});
    if(error)setNotice(error.message); else { if(chatRef.current&&!body)chatRef.current.value=""; loadMessages(); }
  }
  async function shareToFriend(fid,p){ const {error}=await supabase.rpc("send_private_message",{p_receiver_id:fid,p_body:"转发了一条表白墙内容",p_shared_post_id:p.id,p_shared_profile_id:null,p_game_invite:null,p_group_id:null}); if(error)setNotice(error.message); else {await supabase.rpc("share_post",{p_post_id:p.id}); setSharePost(null); loadPosts();} }
  async function recommendFriend(toId,friend){ await sendMessage({receiver:toId,body:`推荐好友：${friend.display_name}，数字ID：${friend.numeric_id}`,profileId:friend.id}); }

  async function saveProfile(){
    const avatar_url=edit.avatar?await upload("avatars",edit.avatar):profile.avatar_url;
    const background_url=edit.bg?await upload("backgrounds",edit.bg):profile.background_url;
    const {error}=await supabase.from("profiles").update({display_name:edit.displayName,avatar_url,background_url}).eq("id",profile.id);
    if(error)setNotice(error.message); else {setNotice("资料已保存。"); boot(profile.id);}
  }
  async function ownerSetNumericId(u,newId){ const {error}=await supabase.rpc("owner_set_numeric_id",{p_user_id:u.id,p_numeric_id:newId}); if(error)setNotice(error.message); else loadProfiles(); }
  async function setRole(u,role){ const {error}=await supabase.rpc("owner_set_role",{p_user_id:u.id,p_role:role}); if(error)setNotice(error.message); else loadProfiles(); }
  async function block(u,b=!u.blocked){ const {error}=await supabase.rpc("manager_block_user",{p_user_id:u.id,p_blocked:b}); if(error)setNotice(error.message); else loadProfiles(); }
  async function createGroup(){ if(!groupName.trim())return; const ids=friendProfiles.map(f=>f.id); const {error}=await supabase.rpc("create_group_chat",{p_name:groupName,p_member_ids:ids}); if(error)setNotice(error.message); else {setGroupName("");loadGroups();}}

  async function inviteGame(friend, type){
    const {data,error}=await supabase.rpc("invite_game",{p_receiver_id:friend.id,p_game_type:type});
    if(error)setNotice(error.message); else {setActiveGame(data); setTab("games"); loadGames(); loadMessages();}
  }
  async function saveGameState(game, board, currentTurn, winner=null, status="active"){
    const {error}=await supabase.from("game_sessions").update({board_state:{board},current_turn:currentTurn,winner_id:winner,status:winner?"finished":status,updated_at:new Date().toISOString()}).eq("id",game.id);
    if(error)setNotice(error.message); else {loadGames(); setActiveGame({...game,board_state:{board},current_turn:currentTurn,winner_id:winner,status:winner?"finished":status});}
  }
  async function recordMove(game, move){ const {error}=await supabase.rpc("create_game_move",{p_game_id:game.id,p_move:move}); if(error)setNotice(error.message); else loadMoves(); }
  function otherPlayer(game){ return game.inviter_id===profile.id?game.opponent_id:game.inviter_id; }

  async function playGomoku(r,c){
    const game=activeGame; if(!game||game.status==="finished")return;
    if(game.current_turn && game.current_turn!==profile.id) return setNotice("还没轮到你。");
    const board=normalizeGomokuBoard(game.board_state?.board);
    if(board[r][c]) return;
    const player=game.inviter_id===profile.id?"black":"white";
    const next=board.map(row=>[...row]); next[r][c]=player;
    const won=checkGomokuWin(next,r,c,player);
    await recordMove(game,{type:"gomoku",r,c,player});
    await saveGameState(game,next,otherPlayer(game),won?profile.id:null,won?"finished":"active");
  }
  async function playChess(r,c){
    const game=activeGame; if(!game||game.status==="finished")return;
    const board=normalizeChessBoard(game.board_state?.board);
    const myColor=game.inviter_id===profile.id?"w":"b";
    const turnColor=game.current_turn===game.inviter_id?"w":"b";
    if(game.current_turn && game.current_turn!==profile.id) return setNotice("还没轮到你。");
    if(!selectedChess){
      if(board[r][c] && board[r][c][0]===myColor && myColor===turnColor) setSelectedChess([r,c]);
      return;
    }
    if(!legalChessMove(board,selectedChess,[r,c],turnColor)){ setSelectedChess(null); return setNotice("这一步不符合简化 Chess 规则。"); }
    const next=board.map(row=>[...row]); const piece=next[selectedChess[0]][selectedChess[1]]; const captured=next[r][c];
    next[r][c]=piece; next[selectedChess[0]][selectedChess[1]]=null; setSelectedChess(null);
    const winner=captured?.[1]==="k"?profile.id:null;
    await recordMove(game,{type:"chess",from:selectedChess,to:[r,c],piece,captured});
    await saveGameState(game,next,otherPlayer(game),winner,winner?"finished":"active");
  }

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
  const myGames=games.filter(g=>g.inviter_id===profile.id||g.opponent_id===profile.id);

  return <>
    <header><div className="topbar"><div className="brand"><div className="logo"><Sparkles/></div><div><h1>{T.title}</h1><p className="sub">{T.subtitle}</p></div></div><div className="tabs"><button className="secondary" onClick={signOut}>{T.signOut}</button></div></div></header>
    <main className="wrap">
      {tab==="wall"&&<div className="grid">
        <aside className="stack">
          <section className="card pad stack"><div className="row"><Avatar url={profile.avatar_url}/><div><h3>{profile.display_name}</h3><p className="mini">ID: {profile.numeric_id}</p></div></div><div className="tabs"><Pill tone={profile.role==="owner"?"yellow":profile.role==="admin"?"green":""}>{roleText(profile.role)}</Pill><Pill tone="pink">{commentCount} 条评论</Pill></div><div className="notice">{T.privacy}</div></section>
          <section className="card pad stack"><h2>{T.publicAdmins}</h2>{publicAdmins.map(u=><div className="friend between" key={u.id}><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id}</div></div></div><Pill tone={u.role==="owner"?"yellow":"green"}>{roleText(u.role)}</Pill></div>)}</section>
          {isManager&&<section className="card pad stack"><h2>{isOwner?T.ownerPanel:T.adminPanel}</h2>{profiles.map(u=><div className="userRow stack" key={u.id}><div className="between"><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id}</div></div></div><Pill tone={u.role==="owner"?"yellow":u.role==="admin"?"green":""}>{roleText(u.role)}</Pill></div><div className="tabs">{isOwner&&u.role==="user"&&<button className="secondary" onClick={()=>setRole(u,"admin")}>{T.makeAdmin}</button>}{isOwner&&u.role==="admin"&&<button className="secondary" onClick={()=>setRole(u,"user")}>{T.removeAdmin}</button>}{isOwner&&u.id!==profile.id&&<button className="secondary" onClick={()=>setRole(u,"owner")}>{T.transferOwner}</button>}{isOwner&&<button className="secondary" onClick={()=>{const v=prompt("新数字 ID",u.numeric_id); if(v)ownerSetNumericId(u,v)}}>{T.setUserId}</button>}{u.role!=="owner"&&<button className="secondary" onClick={()=>block(u)}>{u.blocked?T.unblock:T.block}</button>}</div></div>)}</section>}
        </aside>
        <section className="stack">
          <section className="card pad stack"><div className="tip">{T.ruleTip}</div><div className="between"><h2>{T.submitPost}</h2><Pill tone="yellow">{T.commentRule}</Pill></div><input placeholder={T.receiver} value={post.target} onChange={e=>setPost({...post,target:e.target.value})}/><textarea placeholder={T.placeholder} value={post.body} onChange={e=>setPost({...post,body:e.target.value})}/><div className="between"><label className="row"><input style={{width:"auto"}} type="checkbox" checked={post.anonymous} onChange={e=>setPost({...post,anonymous:e.target.checked})}/>{T.postAnon}</label><label className="soft row" style={{cursor:"pointer"}}><ImageIcon size={16}/>{T.addPhoto}<input style={{display:"none"}} type="file" accept="image/*" onChange={e=>setPost({...post,image:e.target.files?.[0]})}/></label><button onClick={submitPost}><Send size={16}/>{T.sendToReview}</button></div>{notice&&<div className="soft error">{notice}</div>}</section>
          <div className="between"><h2>表白动态</h2><div className="search"><Search size={16}/><input placeholder="搜索内容" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
          {visiblePosts.length===0?<div className="card empty">{T.empty}</div>:visiblePosts.map(p=>{const pcs=comments.filter(c=>c.post_id===p.id);const liked=likes.some(l=>l.post_id===p.id&&l.user_id===profile.id);const author=profiles.find(u=>u.id===(p.public_author_id||p.author_id));return <article className="card" key={p.id}><div className="postHead"><div className="between"><div className="row"><Avatar url={p.anonymous?null:p.public_author_avatar}/><div><div className="row" style={{flexWrap:"wrap"}}>{p.anonymous?<b>Anonymous</b>:<b className="clickable" onClick={()=>setViewProfile(author)}>{p.public_author_name}</b>}<Pill tone={p.status==="approved"?"green":"yellow"}>{p.status==="approved"?T.approved:T.pending}</Pill>{p.target&&<Pill>to: {p.target}</Pill>}</div><div className="mini">{new Date(p.created_at).toLocaleString()} · {T.realHidden}</div></div></div></div><div className="postBody">{p.body}</div>{p.image_url&&<img className="postImage" src={p.image_url}/>}<div className="tabs" style={{marginTop:15}}><button className={liked?"":"secondary"} onClick={()=>like(p)}><Heart size={16}/>{T.like} {p.likes}</button><button className="secondary" onClick={()=>setSharePost(p)}><Share2 size={16}/>{T.share} {p.share_count||0}</button><Pill><MessageCircle size={14}/>{pcs.length} 评论</Pill></div></div><div className="pad stack">{pcs.map(c=>{const cu=profiles.find(u=>u.id===c.author_id);return <div className="comment" key={c.id}><div className="row" style={{alignItems:"flex-start"}}><Avatar url={cu?.avatar_url} small/><div><b>{cu?.display_name||"User"}</b><div>{c.body}</div></div></div>{isManager&&<button className="secondary" onClick={()=>delComment(c.id)}>🗑️</button>}</div>})}<div className="commentForm"><input placeholder={T.addComment} value={commentText[p.id]||""} onChange={e=>setCommentText({...commentText,[p.id]:e.target.value})}/><button onClick={()=>addComment(p.id)}>➤</button></div>{isManager&&<div className="adminStrip">{p.status==="pending"&&<button className="good" onClick={()=>approve(p)}>✓ {T.approve}</button>}<button className="danger" onClick={()=>delPost(p)}>{T.delete}</button>{isOwner&&p.anonymous&&<span className="real">匿名作者：{p.author_display_name||p.author_real_name||"只有群主可见"}</span>}</div>}</div></article>})}
        </section>
      </div>}

      {tab==="chats"&&<section className="stack"><div className="card pad stack"><div className="tip">{T.onlyId}</div><div className="between"><h2>{T.chats}</h2><div className="row" style={{maxWidth:520,flex:1}}><input placeholder={T.addById} value={friendId} onChange={e=>setFriendId(e.target.value.replace(/\D/g,""))}/><button onClick={()=>addFriendById()}><UserPlus size={16}/>{T.addFriend}</button></div></div><div className="row"><input placeholder={T.groupName} value={groupName} onChange={e=>setGroupName(e.target.value)}/><button onClick={createGroup}><Users size={16}/>{T.createGroup}</button></div>{notice&&<p className="error">{notice}</p>}</div><div className="card pad stack"><h2>{T.friends}</h2>{friendProfiles.map(u=><div className="chatRow between" key={u.id}><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id} · {roleText(u.role)}</div></div></div><div className="tabs"><button onClick={()=>{setSelectedChat(u.id);setChatOpen(true)}}>{T.openChat}</button><button className="secondary" onClick={()=>inviteGame(u,"gomoku")}><Gamepad2 size={16}/>五子棋</button><button className="secondary" onClick={()=>inviteGame(u,"chess")}><Swords size={16}/>Chess</button></div></div>)}</div></section>}

      {tab==="games"&&<section className="gameGrid"><div className="card pad stack"><div className="between"><h2>{T.gameCenter}</h2><Pill tone="yellow">{T.simplifiedChess}</Pill></div>{activeGame?<GameBoard game={activeGame} profile={profile} profiles={profiles} playGomoku={playGomoku} playChess={playChess} selectedChess={selectedChess}/>:<div className="empty">从右侧选择一个游戏，或去私聊邀请好友。</div>}</div><div className="card pad stack"><h2>{T.activeGames}</h2>{myGames.length===0&&<div className="soft mini">还没有游戏。去私聊邀请好友。</div>}{myGames.map(g=>{const opp=profiles.find(p=>p.id===(g.inviter_id===profile.id?g.opponent_id:g.inviter_id));return <div className="gameListItem stack" key={g.id}><div className="between"><b>{g.game_type==="gomoku"?T.gomoku:T.chess}</b><Pill tone={g.status==="finished"?"yellow":"green"}>{g.status}</Pill></div><div className="mini">对手：{opp?.display_name||"Unknown"}</div><button onClick={()=>{setActiveGame(g);setSelectedChess(null)}}>{T.openGame}</button></div>})}</div></section>}

      {tab==="mine"&&<section className="profileGrid"><div className="card"><div className="profileHero" style={{backgroundImage:`url(${profile.background_url||""})`}}></div><div className="pad stack"><div className="row"><Avatar url={profile.avatar_url} big/><div><h2>{profile.display_name}</h2><p className="mini">ID: {profile.numeric_id}</p><Pill tone={profile.role==="owner"?"yellow":profile.role==="admin"?"green":""}>{roleText(profile.role)}</Pill></div></div><button onClick={()=>setViewProfile(profile)}><IdCard size={16}/>{T.shareCard}</button><div className="soft">{T.commentRule}<br/><span className="mini">已发表 {commentCount} 条评论</span></div></div></div><div className="card pad stack"><h2><Settings size={20}/>{T.mine}</h2><input value={edit.displayName} onChange={e=>setEdit({...edit,displayName:e.target.value})}/><label className="soft row" style={{cursor:"pointer",justifyContent:"center"}}><Camera size={16}/>{T.changeAvatar}<input style={{display:"none"}} type="file" accept="image/*" onChange={e=>setEdit({...edit,avatar:e.target.files?.[0]})}/></label><label className="soft row" style={{cursor:"pointer",justifyContent:"center"}}><ImageIcon size={16}/>{T.changeBg}<input style={{display:"none"}} type="file" accept="image/*" onChange={e=>setEdit({...edit,bg:e.target.files?.[0]})}/></label><button onClick={saveProfile}>{T.saveProfile}</button>{notice&&<p className="error">{notice}</p>}</div></section>}
    </main>

    <nav className="bottomNav"><button className={tab==="wall"?"active":""} onClick={()=>setTab("wall")}><Home size={16}/>{T.wall}</button><button className={tab==="chats"?"active":""} onClick={()=>setTab("chats")}><MessageCircle size={16}/>{T.chats}</button><button className={tab==="games"?"active":""} onClick={()=>setTab("games")}><Gamepad2 size={16}/>{T.games}</button><button className={tab==="mine"?"active":""} onClick={()=>setTab("mine")}><User size={16}/>{T.mine}</button></nav>

    {chatOpen&&selected&&<div className="modalBg"><div className="modal"><div className="chatWindow"><div className="chatHeader between"><div className="row"><Avatar url={selected.avatar_url} small/><div><b>{selected.display_name}</b><div className="mini" style={{color:"rgba(255,255,255,.7)"}}>ID: {selected.numeric_id}</div></div></div><button className="ghost" style={{color:"white"}} onClick={()=>setChatOpen(false)}><X size={18}/></button></div><div className="chatBox">{selectedMessages.map(m=>{const sp=posts.find(p=>p.id===m.shared_post_id);const su=profiles.find(p=>p.id===m.shared_profile_id);return <div className={`bubble ${m.sender_id===profile.id?"me":"them"}`} key={m.id}><div>{m.body}</div>{m.game_invite&&<div className="sharedCard">🎮 游戏邀请：{m.game_invite==="gomoku"?"五子棋":"Chess"}<br/><button style={{marginTop:8}} onClick={()=>{setTab("games");setChatOpen(false);}}>去游戏中心</button></div>}{sp&&<div className="sharedCard"><b>{sp.anonymous?"Anonymous":sp.public_author_name}</b><div className="mini">{sp.body?.slice(0,90)}...</div>{sp.image_url&&<img src={sp.image_url} style={{width:"100%",borderRadius:12,marginTop:8}}/>}</div>}{su&&<div className="sharedCard"><b>{su.display_name}</b><div className="mini">推荐名片 ID: {su.numeric_id}</div></div>}</div>})}</div><div className="pad commentForm"><input ref={chatRef} placeholder={T.message}/><button onClick={()=>sendMessage()}><Send size={16}/></button></div></div></div></div>}

    {sharePost&&<div className="modalBg"><div className="modal stack"><div className="between"><h2>{T.shareToFriend}</h2><button className="ghost" onClick={()=>setSharePost(null)}><X size={18}/></button></div>{friendProfiles.map(u=><div className="friend between" key={u.id}><div className="row"><Avatar url={u.avatar_url} small/><div><b>{u.display_name}</b><div className="mini">ID: {u.numeric_id}</div></div></div><button onClick={()=>shareToFriend(u.id,sharePost)}><Share2 size={16}/>{T.share}</button></div>)}</div></div>}

    {viewProfile&&<div className="modalBg"><div className="modal stack"><div className="between"><h2>{T.profile}</h2><button className="ghost" onClick={()=>setViewProfile(null)}><X size={18}/></button></div><div className="card"><div className="profileHero" style={{backgroundImage:`url(${viewProfile.background_url||""})`}}></div><div className="pad row"><Avatar url={viewProfile.avatar_url} big/><div><h2>{viewProfile.display_name}</h2><p className="mini">ID: {viewProfile.numeric_id}</p><Pill tone={viewProfile.role==="owner"?"yellow":viewProfile.role==="admin"?"green":""}>{roleText(viewProfile.role)}</Pill></div></div></div><div className="tabs">{viewProfile.id!==profile.id&&<button onClick={()=>addFriendById(viewProfile.numeric_id)}>{T.addFriend}</button>}{friendProfiles.map(f=><button className="secondary" key={f.id} onClick={()=>recommendFriend(f.id,viewProfile)}>{T.recommendFriend}给 {f.display_name}</button>)}</div></div></div>}
  </>;
}

function GameBoard({game,profile,profiles,playGomoku,playChess,selectedChess}){
  const opponent=profiles.find(p=>p.id===(game.inviter_id===profile.id?game.opponent_id:game.inviter_id));
  const isTurn=game.current_turn===profile.id || !game.current_turn;
  return <div className="stack">
    <div className="statusBanner"><b>{game.game_type==="gomoku"?"五子棋":"Chess"}</b> · 对手：{opponent?.display_name||"Unknown"} · {game.status==="finished"?T.gameOver:(isTurn?T.yourTurn:T.notYourTurn)}</div>
    <div className="boardWrap">
      {game.game_type==="gomoku"?<GomokuBoard game={game} play={playGomoku}/>:<ChessBoard game={game} play={playChess} selected={selectedChess}/>}
    </div>
  </div>
}

function GomokuBoard({game,play}){
  const board=normalizeGomokuBoard(game.board_state?.board);
  return <div className="gomoku">{board.map((row,r)=>row.map((cell,c)=><div className="gCell" key={`${r}-${c}`} onClick={()=>play(r,c)}>{cell&&<div className={`stone ${cell}`}/>}</div>))}</div>
}

function ChessBoard({game,play,selected}){
  const board=normalizeChessBoard(game.board_state?.board);
  return <div className="chess">{board.map((row,r)=>row.map((cell,c)=>{
    const sel=selected&&selected[0]===r&&selected[1]===c;
    return <div className={`cCell ${(r+c)%2===0?"light":"dark"} ${sel?"selected":""}`} key={`${r}-${c}`} onClick={()=>play(r,c)}>{cell?chessIcon[cell]:""}</div>
  }))}</div>
}
