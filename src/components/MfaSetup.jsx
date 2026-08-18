import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MfaSetup({ required=false,onClose,onVerified }) {
  const [factor,setFactor]=useState(null)
  const [enrollment,setEnrollment]=useState(null)
  const [code,setCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [aal,setAal]=useState({currentLevel:null,nextLevel:null})
  const load=async()=>{
    const [factors,levels]=await Promise.all([supabase.auth.mfa.listFactors(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()])
    if(factors.error) setNotice(factors.error.message)
    const verified=(factors.data?.totp||[]).find((item)=>item.status==='verified')
    setFactor(verified||null); if(levels.data) setAal(levels.data)
  }
  useEffect(()=>{load()},[])
  const enroll=async()=>{
    setBusy(true);setNotice('')
    const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'AnimeConect Authenticator'})
    setBusy(false);if(error)return setNotice(error.message);setEnrollment(data);setFactor(data)
  }
  const verify=async(event)=>{
    event.preventDefault();if(!factor||code.length!==6)return
    setBusy(true);setNotice('')
    const challenge=await supabase.auth.mfa.challenge({factorId:factor.id})
    if(challenge.error){setBusy(false);return setNotice(challenge.error.message)}
    const result=await supabase.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code})
    setBusy(false);if(result.error)return setNotice(result.error.message)
    setCode('');setEnrollment(null);setNotice('Segundo fator confirmado. Sua sessão está protegida em AAL2.');await load();onVerified?.()
  }
  const remove=async()=>{
    if(!factor)return
    setBusy(true);const {error}=await supabase.auth.mfa.unenroll({factorId:factor.id});setBusy(false)
    if(error)return setNotice(error.message);setFactor(null);setEnrollment(null);setNotice('Segundo fator removido.')
  }
  const needsChallenge=factor&&aal.currentLevel!=='aal2'
  return <div className="mfa-backdrop"><section className="mfa-window"><header><div><span className="kicker">PROTEÇÃO DA CONTA</span><h2>Autenticação em dois fatores</h2></div>{!required&&<button onClick={onClose}>×</button>}</header><p>Use Google Authenticator, Microsoft Authenticator, 1Password ou outro aplicativo compatível com TOTP.</p>{required&&<div className="mfa-required">Esta conta exige o código do autenticador para acessar recursos administrativos.</div>}{notice&&<div className="mfa-notice">{notice}</div>}
    {!factor&&!enrollment&&<div className="mfa-step"><strong>O segundo fator ainda não está configurado.</strong><p>Ao ativar, o login exigirá sua senha e um código temporário.</p><button className="primary" disabled={busy} onClick={enroll}>{busy?'Preparando...':'Ativar com aplicativo'}</button></div>}
    {enrollment&&<div className="mfa-enrollment"><h3>1. Escaneie o QR Code</h3><img src={enrollment.totp.qr_code} alt="QR Code para configurar o autenticador"/><details><summary>Não consegue escanear?</summary><code>{enrollment.totp.secret}</code></details><h3>2. Confirme o código</h3><CodeForm code={code} setCode={setCode} verify={verify} busy={busy}/></div>}
    {needsChallenge&&!enrollment&&<div className="mfa-step"><h3>Confirme sua identidade</h3><p>Digite o código atual exibido no aplicativo autenticador.</p><CodeForm code={code} setCode={setCode} verify={verify} busy={busy}/></div>}
    {factor&&aal.currentLevel==='aal2'&&!enrollment&&<div className="mfa-active"><strong>✓ Segundo fator ativo</strong><p>Sessão verificada com nível de garantia AAL2.</p><button onClick={remove} disabled={busy}>Remover segundo fator</button></div>}
  </section></div>
}

function CodeForm({code,setCode,verify,busy}){return <form className="mfa-code" onSubmit={verify}><input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,''))} placeholder="000000"/><button className="primary" disabled={busy||code.length!==6}>{busy?'Verificando...':'Confirmar código'}</button></form>}
