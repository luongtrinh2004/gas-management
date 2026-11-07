'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  return (
    <div className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-end flex-wrap gap-4')}>
      <p>
        <span className='text-textSecondary'>{`© ${new Date().getFullYear()}, `}</span>
        <Link href='https://www.facebook.com/erictrinh464' target='_blank' rel='noopener noreferrer' className='text-primary'>
          Lương Trịnh - 0816260406
        </Link>
      </p>
    </div>
  )
}

export default FooterContent
