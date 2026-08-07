import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
if (import.meta.env.VITE_TURN_URL) iceServers.push({ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL })

export default function CallRoom({ room, user, onLeave }) {
  const localVideo = useRef(null)
  const stream = useRef(null)
  const peers = useRef(new Map())
  const [remoteStreams, setRemoteStreams] = useState({})
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(room.media_type === 'video')
  const [error, setError] = useState('')

  useEffect(() => {
    let channel
    let mounted = true
    const signal = async (to, type, payload) => supabase.from('call_signals').insert({ room_id: room.id, from_user: user.id, to_user: to, signal_type: type, payload })
    const ensurePeer = async (peerId, initiator = false) => {
      if (peers.current.has(peerId)) return peers.current.get(peerId)
      const peer = new RTCPeerConnection({ iceServers })
      peers.current.set(peerId, peer)
      stream.current?.getTracks().forEach((track) => peer.addTrack(track, stream.current))
      peer.onicecandidate = (event) => event.candidate && signal(peerId, 'ice', event.candidate.toJSON())
      peer.ontrack = (event) => setRemoteStreams((items) => ({ ...items, [peerId]: event.streams[0] }))
      peer.onconnectionstatechange = () => { if (['failed','closed','disconnected'].includes(peer.connectionState)) setRemoteStreams((items) => { const next = { ...items }; delete next[peerId]; return next }) }
      if (initiator) { const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await signal(peerId, 'offer', offer) }
      return peer
    }
    const handleSignal = async (item) => {
      if (item.to_user !== user.id) return
      const peer = await ensurePeer(item.from_user)
      if (item.signal_type === 'offer') { await peer.setRemoteDescription(item.payload); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); await signal(item.from_user, 'answer', answer) }
      if (item.signal_type === 'answer') await peer.setRemoteDescription(item.payload)
      if (item.signal_type === 'ice') await peer.addIceCandidate(item.payload).catch(() => undefined)
    }
    const start = async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: room.media_type === 'video' })
        if (!mounted) return
        if (localVideo.current) localVideo.current.srcObject = stream.current
        const participants = await supabase.from('call_participants').select('user_id').eq('room_id', room.id).is('left_at', null).neq('user_id', user.id)
        for (const item of participants.data || []) await ensurePeer(item.user_id, user.id < item.user_id)
        channel = supabase.channel(`secure-call-${room.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_participants', filter: `room_id=eq.${room.id}` }, ({ new: item }) => item.user_id !== user.id && ensurePeer(item.user_id, user.id < item.user_id))
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `room_id=eq.${room.id}` }, ({ new: item }) => handleSignal(item))
          .subscribe()
      } catch (reason) { setError(reason.name === 'NotAllowedError' ? 'Permissão de câmera ou microfone negada.' : 'Não foi possível iniciar a chamada.') }
    }
    start()
    return () => { mounted = false; if (channel) supabase.removeChannel(channel); stream.current?.getTracks().forEach((track) => track.stop()); peers.current.forEach((peer) => peer.close()); supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('room_id', room.id).eq('user_id', user.id).then(() => undefined) }
  }, [room, user.id])

  const toggleMic = () => { const next = !mic; stream.current?.getAudioTracks().forEach((track) => { track.enabled = next }); setMic(next) }
  const toggleCamera = () => { const next = !camera; stream.current?.getVideoTracks().forEach((track) => { track.enabled = next }); setCamera(next) }
  return <div className="call-overlay"><section className="call-window"><div className="call-heading"><div><span className="live-dot">●</span> Chamada {room.media_type === 'video' ? 'de vídeo' : 'de áudio'}</div><span>Criptografia WebRTC em trânsito</span></div>{error ? <div className="call-error">{error}</div> : <div className="video-grid"><video ref={localVideo} autoPlay muted playsInline/><span className="video-label">Você</span>{Object.entries(remoteStreams).map(([id,remote]) => <RemoteVideo key={id} stream={remote}/>)}</div>}<div className="call-controls"><button onClick={toggleMic}>{mic ? '🎙 Microfone' : '🔇 Ativar microfone'}</button>{room.media_type === 'video' && <button onClick={toggleCamera}>{camera ? '📹 Câmera' : '🚫 Ativar câmera'}</button>}<button className="hangup" onClick={onLeave}>Encerrar</button></div></section></div>
}

function RemoteVideo({ stream }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
  return <video ref={ref} autoPlay playsInline/>
}
