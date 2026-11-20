/* Comportamiento de formularios: validación, envío y mensajes de estado. */
// Formularios: <form data-form="contact|partner">. Validación, carga, éxito y error.
document.querySelectorAll('form[data-form]').forEach(f=>{
 const status=f.querySelector('.status'),btn=f.querySelector('button[type=submit]'),label=btn.textContent;
 const show=(m,ok)=>{status.hidden=false;status.className='status '+(ok?'ok':'bad');status.textContent=m};
 const check=el=>{let m='';const v=el.value.trim();
  if(el.required&&!v)m='Este campo es obligatorio.';
  else if(el.type==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))m='Escribe un correo válido, por ejemplo nombre@correo.com.';
  else if(el.type==='tel'&&v&&!/^[\d\s+()-]{7,}$/.test(v))m='Escribe un teléfono válido.';
  const e=el.parentElement.querySelector('.err');e.textContent=m;el.setAttribute('aria-invalid',!!m);return!m};
 f.querySelectorAll('input,select,textarea').forEach(el=>{const e=document.createElement('span');e.className='err';e.setAttribute('role','alert');el.after(e);el.onblur=()=>check(el)});
 f.onsubmit=async ev=>{ev.preventDefault();status.hidden=true;
  const fields=[...f.elements].filter(x=>x.name);
  if(!fields.map(check).every(Boolean)){show('Corrige los campos marcados para continuar.',false);f.querySelector('[aria-invalid=true]').focus();return}
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>Enviando…';
  try{await api.post(f.dataset.form,Object.fromEntries(fields.map(x=>[x.name,x.value.trim()])));
   f.reset();show('¡Listo! Recibimos tu mensaje y te responderemos pronto.',true)}
  catch(e){show(e.message||'No pudimos enviar el formulario. Intenta de nuevo.',false)}
  finally{btn.disabled=false;btn.textContent=label}};
});
