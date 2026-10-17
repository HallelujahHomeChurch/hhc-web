import {expect, it, vi} from 'vitest'
import {UnitNotificationsApi} from './notifications-api'
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/observability', () => ({captureHandledError: capture}))
it('keeps telemetry failures from masking an HTTP error or resending a notification', async () => {
 capture.mockImplementationOnce(() => {throw new Error('telemetry offline')})
 const fetch = vi.fn(async () => Response.json({error:'unavailable'}, {status:503}))
 const api = new UnitNotificationsApi({getAccessToken:()=> 'token',fetch})
 await expect(api.submit('unit','subject','body','key')).rejects.toMatchObject({status:503})
 expect(fetch).toHaveBeenCalledOnce()
})
