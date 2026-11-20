/* Efectos visuales generales: marquesina, animaciones al desplazarse y header. */
// Detalles de interfaz: marquesina, aparición al hacer scroll, sombra del header.
const d=document;d.documentElement.classList.add('js');
d.querySelectorAll('.marq').forEach(m=>{
 const s=['Gimnasio','Deporte','Nutrición','Entrena','Come bien','Vive mejor'].map(x=>`<span>${x}</span><span>●</span>`).join('');
 m.setAttribute('aria-hidden','true');m.innerHTML=`<div>${s+s+s+s}</div>`});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
d.querySelectorAll('.rv').forEach(el=>io.observe(el));
const h=d.querySelector('header');addEventListener('scroll',()=>h&&h.classList.toggle('sc',scrollY>8),{passive:true});

const successStories=d.querySelector('#success-stories');
if(successStories){
 const escapeStory=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 fetch('/api/stories').then(response=>response.ok?response.json():Promise.reject()).then(({stories=[]})=>{
  if(!stories.length)return;
  successStories.innerHTML=stories.map(story=>{
   const image=typeof story.image==='string'&&story.image.startsWith('/uploads/')?`<img src="${escapeStory(story.image)}" alt="${escapeStory(story.person)}" loading="lazy">`:'';
   return `<article class="success-card">${image}<div class="success-card-body"><h3>${escapeStory(story.title)}</h3><span class="success-person">${escapeStory(story.person)}</span><p>${escapeStory(story.description)}</p>${story.result?`<span class="success-result">${escapeStory(story.result)}</span>`:''}</div></article>`;
  }).join('');
 }).catch(()=>{});
}
