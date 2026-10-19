import {render, screen} from '@testing-library/react'
import {beforeEach, expect, it, vi} from 'vitest'
import {OrganizationClientsProvider, useOrganizationApi} from './context'
const state=vi.hoisted(()=>({owner:'owner',auth:{getSnapshot:vi.fn(),subscribe:vi.fn()},authorization:{getAccessToken:vi.fn(),refreshAfterUnauthorized:vi.fn()},create:vi.fn(),list:vi.fn()}))
vi.mock('@/components/layout/AccountControl',()=>({useAccountIdentity:()=>state.owner,useAccountAuthorization:()=>state.authorization,useInboxAuthRuntime:()=>state.auth}))
vi.mock('@hallelujahhomechurch/operations-client',()=>({OperationsApiError:class extends Error {},createOperationsClient:(...args:unknown[])=>{state.create(...args);return {raw:{use:vi.fn()},listOrgUnitDirectory:state.list}}}))
beforeEach(()=>vi.clearAllMocks())
it('uses the same existing account runtime and token/refresh callbacks for the fixed discovery method',()=>{
 function Probe(){const {operationsApi}=useOrganizationApi();return <button onClick={()=>void operationsApi.listOrgUnitDirectory({relation:'all'})}>Load</button>}
 render(<OrganizationClientsProvider locale="en"><Probe/></OrganizationClientsProvider>);
 expect(state.create).toHaveBeenCalledWith(expect.objectContaining({baseUrl:'',auth:state.auth,getAccessToken:state.authorization.getAccessToken,refreshAfterUnauthorized:state.authorization.refreshAfterUnauthorized}));screen.getByRole('button').click();expect(state.list).toHaveBeenCalledWith({relation:'all'});
})
it('forces every group transport read through the existing no-store fetcher',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response());vi.stubGlobal('fetch',fetcher)
 render(<OrganizationClientsProvider locale="en"><p>Connected</p></OrganizationClientsProvider>);
 await state.create.mock.calls[0][0].fetcher('/api/operations/me/org-units',{headers:{Accept:'application/json'}})
 expect(fetcher).toHaveBeenCalledWith('/api/operations/me/org-units',{headers:{Accept:'application/json'},cache:'no-store'})
})
