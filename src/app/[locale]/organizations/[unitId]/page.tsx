'use client'
import {useAccountIdentity} from '@/components/layout/AccountControl'
import {useParams} from 'next/navigation'
import {OrganizationUnitPage} from '@/features/organizations/OrganizationUnitPage'
import {useOrganizationsSearch} from '@/features/organizations/OrganizationsSearch'
export default function UnitPage() {
  const search = useOrganizationsSearch()
  const owner = useAccountIdentity()
  const {unitId} = useParams<{unitId: string}>()
  return <OrganizationUnitPage key={`${owner}:${unitId}`} searchQuery={search?.query} onSearchAvailabilityChange={search?.setAvailable} />
}
