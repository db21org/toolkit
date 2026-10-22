export const graphPage = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Toolkit graph explorer</title><link rel="stylesheet" href="/style.css"></head>
<body><header><strong>Toolkit graph explorer</strong><span>Read-only · RDF edges are not verified facts</span></header>
<nav aria-label="Graph navigation"><button id="home">Overview</button><button id="back">Back</button>
<button id="previous">Previous page</button><button id="next">Next page</button>
<button id="smaller" aria-label="Zoom out">−</button><button id="larger" aria-label="Zoom in">+</button><button id="fit">Fit</button><button id="download">Download SVG</button></nav>
<form id="jump"><label for="iri">Open node IRI</label><input id="iri" type="text" placeholder="https://example.org/resource or urn:…" required><button>Explore</button></form>
<p id="connection"></p><h1 id="title">Loading graph…</h1><p id="description"></p><p id="status" role="status" aria-live="polite"></p>
<main id="canvas" aria-label="Graph visualization"></main><script src="/app.js" defer></script></body></html>`;

export const GRAPH_STYLE = `
:root{font-family:system-ui,sans-serif;color:#0f172a;background:#f8fafc}
body{margin:0;padding:20px}header{display:flex;gap:24px;align-items:center;flex-wrap:wrap}header strong{font-size:22px}header span,#connection,#description{color:#475569}
nav,form{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;align-items:center}button,input{font:inherit;border:1px solid #94a3b8;border-radius:6px;padding:8px 12px;background:white;color:#0f172a}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}input{flex:1;min-width:200px}h1{font-size:22px;margin-bottom:6px}#description{max-width:1100px;line-height:1.5}#connection{font-size:13px;overflow-wrap:anywhere}#status{color:#9f1239;white-space:pre-wrap}main{overflow:auto;border:1px solid #cbd5e1;border-radius:10px;background:white;min-height:250px}svg{display:block;min-width:600px;height:auto}svg text{font-family:system-ui,sans-serif;fill:#0f172a}svg a:hover rect,svg a:focus rect{stroke:#2563eb;stroke-width:3}svg a{cursor:pointer}`;

export const graphScript = String.raw`
"use strict";
const ns = "http://www.w3.org/2000/svg";
const byId = (id) => document.getElementById(id);
const colors = {class:"#dbeafe",node:"#ccfbf1",literal:"#ede9fe",blank:"#fef3c7"};
let controller;
let view;
let zoom = 1;
let currentSvg;
let generation = 0;
const node = (tag, attributes = {}, text) => {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
};
const shorten = (text, max) => text.length > max ? text.slice(0,max-1) + "…" : text;
const name = (iri) => iri.split(/[/#:]/).pop() || iri;
const lines = (text, width, count) => {
  const words = text.replace(/\s+/g," ").split(" ");
  const output = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + word.length + 1 > width) { output.push(line); line = ""; }
    if (word.length > width) {
      if (line) { output.push(line); line = ""; }
      for(let start = 0; start < word.length; start += width) output.push(word.slice(start,start+width));
    } else line += (line ? " " : "") + word;
  }
  if(line) output.push(line);
  return output.length > count ? [...output.slice(0,count-1), shorten(output.slice(count-1).join(" "),width)] : output;
};
const route = (mode, id = "", offset = 0) => "/?" + new URLSearchParams({mode,id,offset:String(offset)});
const navigate = (mode, id, offset = 0) => { history.pushState(null,"",route(mode,id,offset)); load(); };
const edge = (svg, x1,y1,x2,y2,label) => {
  const middle = (x1+x2)/2;
  const path = node("path",{d:"M"+x1+","+y1+" C"+middle+","+y1+" "+middle+","+y2+" "+x2+","+y2,
    fill:"none",stroke:"#94a3b8","stroke-width":1.6,"marker-end":"url(#arrow)"});
  path.append(node("title",{},label)); svg.append(path);
  if(label){
    const text = shorten(name(label),28);
    svg.append(node("rect",{x:middle-text.length*3.4,y:(y1+y2)/2-15,width:text.length*6.8,height:19,fill:"white"}));
    svg.append(node("text",{x:middle,y:(y1+y2)/2,"font-size":11,"text-anchor":"middle"},text));
  }
};
const card = (svg, item, x,y,width=340,height=150) => {
  const expandable = item.kind === "class" || item.kind === "node";
  const group = node(expandable ? "a" : "g",expandable ? {href:route(item.kind === "class" ? "class":"node",item.id)} : {});
  group.append(node("title",{},item.detail + (item.predicate ? "\nPredicate: " + item.predicate : "")));
  if(expandable) group.addEventListener("click",(event)=>{
    if(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(item.kind === "class" ? "class":"node",item.id);
  });
  group.append(node("rect",{x,y,width,height,rx:10,fill:colors[item.kind],stroke:"#64748b"}));
  group.append(node("text",{x:x+12,y:y+22,"font-size":11,"font-weight":"bold"},item.kind.toUpperCase() + (item.count !== undefined ? " · " + item.count + " instances" : "")));
  lines(item.label,Math.floor((width-24)/8),5).forEach((line,i)=>group.append(node("text",{x:x+12,y:y+46+i*18,"font-size":13},line)));
  svg.append(group);
};
const render = (data, mode) => {
  const svg = node("svg",{xmlns:ns,role:"group","aria-label":data.title});
  const defs = node("defs");
  const marker = node("marker",{id:"arrow",markerWidth:8,markerHeight:8,refX:7,refY:4,orient:"auto"});
  marker.append(node("path",{d:"M0,0 L8,4 L0,8 Z",fill:"#94a3b8"})); defs.append(marker); svg.append(defs);
  svg.append(node("title",{},data.title),node("desc",{},data.description));
  let width = 1500;
  let height;
  if(mode === "node") {
    const incoming = data.cards.filter((item)=>item.direction === "in");
    const outgoing = data.cards.filter((item)=>item.direction === "out");
    height = Math.max(500,Math.max(incoming.length,outgoing.length)*195+150);
    const center = height/2;
    incoming.forEach((item,i)=>edge(svg,375,155+i*195,580,center,item.predicate));
    outgoing.forEach((item,i)=>edge(svg,920,center,1125,155+i*195,item.predicate));
    incoming.forEach((item,i)=>card(svg,item,35,80+i*195));
    outgoing.forEach((item,i)=>card(svg,item,1125,80+i*195));
    card(svg,data.focus,580,center-75);
    svg.append(node("text",{x:35,y:36,"font-size":15,"font-weight":"bold"},"INCOMING"),node("text",{x:1125,y:36,"font-size":15,"font-weight":"bold"},"OUTGOING"));
  } else {
    const rows = Math.ceil(data.cards.length/3);
    height = Math.max(350,rows*190+90);
    data.cards.forEach((item,i)=>card(svg,item,35+(i%3)*490,55+Math.floor(i/3)*190,450));
    if(!data.cards.length) svg.append(node("text",{x:35,y:80,"font-size":18},"No matching IRI instances or classes in this scope."));
  }
  svg.setAttribute("viewBox","0 0 "+width+" "+height);
  svg.setAttribute("width",String(width)); svg.setAttribute("height",String(height));
  currentSvg = svg;
  zoom = 1;
  svg.style.width = "100%";
  byId("canvas").replaceChildren(svg);
};
const load = async () => {
  const requestGeneration = ++generation;
  controller?.abort(); controller = new AbortController();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "overview";
  const id = params.get("id") || "";
  const offset = params.get("offset") || "0";
  byId("status").textContent = "Loading…";
  for(const button of ["previous","next","download"]) byId(button).disabled = true;
  try {
    const response = await fetch("/view?"+new URLSearchParams({mode,id,offset}),{signal:controller.signal});
    const result = await response.json();
    if(!response.ok) throw new Error(result.error || "Graph request failed.");
    if(requestGeneration !== generation) return;
    view = result;
    byId("title").textContent = result.title;
    byId("description").textContent = result.description;
    byId("iri").value = id;
    byId("status").textContent = result.more ? "Showing 24 results. More available on next page." : result.cards.length + " results on this page.";
    byId("previous").disabled = result.offset === 0;
    byId("next").disabled = !result.more;
    byId("download").disabled = false;
    render(result,mode);
  } catch(error) {
    if(error.name !== "AbortError" && requestGeneration === generation){ byId("status").textContent = error.message; byId("canvas").replaceChildren(); }
  }
};
byId("home").onclick = () => navigate("overview","");
byId("back").onclick = () => history.back();
byId("previous").onclick = () => { const p = new URLSearchParams(location.search); navigate(p.get("mode") || "overview",p.get("id") || "",Math.max(0,view.offset-24)); };
byId("next").onclick = () => { const p = new URLSearchParams(location.search); navigate(p.get("mode") || "overview",p.get("id") || "",view.offset+24); };
byId("jump").onsubmit = (event) => { event.preventDefault(); navigate("node",byId("iri").value.trim()); };
byId("smaller").onclick = () => { if(currentSvg) currentSvg.style.width = (zoom = Math.max(.25,zoom/1.25))*100+"%"; };
byId("larger").onclick = () => { if(currentSvg) currentSvg.style.width = (zoom = Math.min(5,zoom*1.25))*100+"%"; };
byId("fit").onclick = () => { if(currentSvg) currentSvg.style.width = (zoom = 1)*100+"%"; };
byId("download").onclick = () => {
  const exported = currentSvg.cloneNode(true);
  exported.removeAttribute("style");
  exported.querySelectorAll("a").forEach((link)=>{ link.removeAttribute("href"); });
  const style = node("style",{},"text{font-family:system-ui,sans-serif;fill:#0f172a}");
  exported.prepend(style);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(exported)],{type:"image/svg+xml"}));
  const link = document.createElement("a"); link.href = url; link.download = "graph.svg"; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener("popstate",load);
fetch("/connection").then((response)=>response.json()).then((data)=>{ byId("connection").textContent = data.endpoint + " · " + (data.graph ? "Named graph: "+data.graph : "Default and named graphs; historical revisions may coexist"); }).catch(()=>{});
load();
`;
