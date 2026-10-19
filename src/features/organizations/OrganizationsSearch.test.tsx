import {fireEvent, render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {useState} from 'react'
import {NextIntlClientProvider} from 'next-intl'
import {expect, it, vi} from 'vitest'
import {OrganizationsSearch, OrganizationsSearchContext} from './OrganizationsSearch'
const copy = {site:{search:{members:'Search members',submit:'Search',clear:'Clear search',close:'Close search'}}}
function Search({available=true}: {available?: boolean}) {
 const [query,setQuery] = useState('')
 return <NextIntlClientProvider locale="en" messages={copy}><OrganizationsSearchContext.Provider value={{query,setQuery,available,setAvailable:vi.fn()}}><OrganizationsSearch onExpandedChange={vi.fn()}/></OrganizationsSearchContext.Provider></NextIntlClientProvider>
}
it('keeps an applied member query visible and clearable after collapsing', async () => {
 render(<Search />)
 await userEvent.click(screen.getByRole('button',{name:'Search members'}))
 await userEvent.type(screen.getByRole('searchbox'),'Alice{Enter}')
 expect(screen.getByText('Alice')).toBeVisible()
 await userEvent.click(within(screen.getByText('Alice').parentElement!).getByRole('button',{name:'Clear search'}))
 expect(screen.queryByText('Alice')).not.toBeInTheDocument()
})
it('disables member search before a current unit is authorized and loaded', () => {
 render(<Search available={false}/>)
 expect(screen.getByRole('button',{name:'Search members'})).toBeDisabled()
})

it('labels root search as group names and fences header composition from debounced directory requests',()=>{
 const setComposing=vi.fn(),setQuery=vi.fn()
 const messages={site:{search:{...copy.site.search,groups:'Search small groups or fellowships'}}}
 render(<NextIntlClientProvider locale="en" messages={messages}><OrganizationsSearchContext.Provider value={{query:'',kind:'groups',setQuery,available:true,setAvailable:vi.fn(),setComposing}}><OrganizationsSearch onExpandedChange={vi.fn()}/></OrganizationsSearchContext.Provider></NextIntlClientProvider>)
 expect(screen.getByRole('button',{name:'Search small groups or fellowships'})).toBeEnabled()
 const root=screen.getByRole('searchbox')
 fireEvent.compositionStart(root);expect(setComposing).toHaveBeenLastCalledWith(true)
 fireEvent.compositionEnd(root);expect(setComposing).toHaveBeenLastCalledWith(false)
})
