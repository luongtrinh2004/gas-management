'use client'

import Typography from '@mui/material/Typography'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from 'next/link'

export default function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className='flex flex-wrap items-start justify-between gap-4 mbe-6'>
      <div className='flex flex-col gap-1 min-is-0'>
        {back && (
          <Breadcrumbs>
            <Link href={back.href} className='text-textSecondary no-underline hover:underline'>
              {back.label}
            </Link>
          </Breadcrumbs>
        )}
        <Typography variant='h4'>{title}</Typography>
        {subtitle && (
          <Typography variant='body2' color='text.secondary'>
            {subtitle}
          </Typography>
        )}
      </div>
      {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
    </div>
  )
}
