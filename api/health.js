export default async function handler(request,response){
  if(request.method!=='GET')return response.status(405).json({ok:false,error:'method_not_allowed'})
  const secret=process.env.CRON_SECRET
  if(!secret||request.headers.authorization!==`Bearer ${secret}`)return response.status(401).json({ok:false,error:'unauthorized'})
  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL
  const anonKey=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY
  if(!supabaseUrl||!anonKey)return response.status(503).json({ok:false,error:'database_configuration_missing'})
  try{
    const databaseResponse=await fetch(`${supabaseUrl}/rest/v1/communities?select=id&limit=1`,{headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`},signal:AbortSignal.timeout(8000)})
    if(!databaseResponse.ok)return response.status(503).json({ok:false,error:'database_unavailable',status:databaseResponse.status})
    response.setHeader('Cache-Control','no-store')
    return response.status(200).json({ok:true,service:'animeconect-database',checkedAt:new Date().toISOString()})
  }catch(error){
    return response.status(503).json({ok:false,error:'health_check_failed',type:error?.name||'Error'})
  }
}
