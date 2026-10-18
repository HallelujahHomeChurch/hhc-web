import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { useOrganizationApi } from './context'
import { messages } from './messages'
import { OrganizationNotificationDialog } from './OrganizationNotificationDialog'

vi.mock('./context', () => ({ useOrganizationApi: vi.fn(), useOrganizationMessages: () => ({ locale: 'en', messages: messages.en }) }))


const api = { list: vi.fn(), preview: vi.fn(), submit: vi.fn() }
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue({ items: [], page: 1, perPage: 20, total: 0 }); api.preview.mockResolvedValue({ audienceAccounts: 2, emailRecipients: 1, webPushDevices: 3 }); vi.mocked(useOrganizationApi).mockReturnValue({ unitNotificationsApi: api } as never) })

it('forces one paired send after audience confirmation', async () => {
  api.submit.mockResolvedValue({ id: 'n1', orgUnitId: 'unit', subject: '主旨', body: '第一行\n第二行', audienceAccountCount: 2, createdAt: '2026-09-25T00:00:00Z', channels: [{ campaignId: 'e', channel: 'email', status: 'scheduled', recipientCount: 1 }, { campaignId: 'p', channel: 'web_push', status: 'scheduled', recipientCount: 3 }] })
  render(<OrganizationNotificationDialog isOpen unitId="unit" onOpenChange={vi.fn()} />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), '主旨')
  await userEvent.type(screen.getByRole('textbox', { name: 'Body' }), '第一行{enter}第二行')
  await userEvent.click(screen.getByRole('button', { name: 'Preview audience' }))
  expect(await screen.findByText('3')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(api.submit).toHaveBeenCalledWith('unit', '主旨', '第一行\n第二行', expect.any(String))
})

it('shows history placeholders initially and keeps ready history and draft during refresh',async()=>{
 let finish!:(value:unknown)=>void;
 api.list.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const view=render(<OrganizationNotificationDialog isOpen unitId="unit" onOpenChange={vi.fn()}/>);
 expect(view.baseElement.querySelector('[data-loading-layout="organization-history"]')).not.toBeNull();
 const {act}=await import('@testing-library/react');
 await act(async()=>finish({items:[{id:'notice',subject:'Earlier notice',body:'Message',createdAt:'2026-10-17T00:00:00Z',channels:[]}],page:1,perPage:10,total:1}));
 await screen.findByText('Earlier notice');
 await userEvent.type(screen.getByRole('textbox',{name:'Subject'}),'Draft subject');
 api.list.mockImplementationOnce(()=>new Promise(()=>{}));
 await userEvent.click(screen.getByRole('button',{name:messages.en.organizations.refresh}));
 expect(screen.getByText('Earlier notice')).toBeInTheDocument();
 expect(screen.getByRole('textbox',{name:'Subject'})).toHaveValue('Draft subject');
});
