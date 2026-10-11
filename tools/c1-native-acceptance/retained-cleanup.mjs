import { manifest, check, scopedHeaders, requireDeploymentProtection,
  bypassCleanupEvidence, withTimeout } from "./policy.mjs";
import { waitForObservation } from "./supervision.mjs";
import { abortable } from "./lifecycle.mjs";

// Read-only coordination and two final HTTP challenges. No management capability.
export async function completeBypassCleanup({credential,budget,deadline,env,config,adapters={}}) {
  const requestedAt=Date.now(), end=Math.min(requestedAt+110000,deadline-5000);
  check(credential?.mode==="automation-bypass" && Number.isInteger(end) && end>requestedAt+20000);
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),end-requestedAt);
  const bounded=fn=>withTimeout(()=>abortable(fn,controller.signal),Math.max(1,end-Date.now()));
  try {
    (adapters.signal??(()=>console.log("C1_BYPASS_CLEANUP_WAIT")))();
    const receiptTimeout=Math.min(90000,end-requestedAt-20000);
    const observation=await withTimeout(()=>bounded(()=>(adapters.observation??waitForObservation)(
      env,config,"bypass-revoked",undefined,manifest,{requestedAt},
      {timeoutMs:receiptTimeout,signal:controller.signal})),receiptTimeout);
    const statuses=[];
    // Attempt BOTH controls once even if the first fails. Never repeat acceptance.
    let failed=false;
    for (const headers of [scopedHeaders(manifest.origin+"/",credential),{}]) {
      try {
        check(!controller.signal.aborted && Date.now()<end);
        budget.take({cleanup:true});
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]);
        const status=await withTimeout(()=>abortable(async()=>{
          const response=await (adapters.fetch??fetch)(manifest.origin+"/",{
            headers,redirect:"manual",cache:"no-store",signal});
          return requireDeploymentProtection(response);
        },signal),5000);
        check(!signal.aborted && Date.now()<end);
        statuses.push(status);
      } catch { failed=true; }
    }
    check(!failed && statuses.length===2 && !controller.signal.aborted && Date.now()<end);
    return bypassCleanupEvidence({revocationReceipt:observation.receipt,
      requestedAt:new Date(requestedAt).toISOString(),verifiedAt:new Date().toISOString(),
      oldKeyStatus:statuses[0],ordinaryStatus:statuses[1]});
  } finally { clearTimeout(timer); controller.abort(); }
}
