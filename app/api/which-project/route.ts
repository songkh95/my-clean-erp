import { NextResponse } from 'next/server'
import path from 'path'

/** localhost:3000 이 어느 폴더에서 켜졌는지 확인용 */
export async function GET() {
  const cwd = process.cwd()
  const isFolderOne = /my-clean-erp-main \(1\)/i.test(cwd)
  return NextResponse.json({
    ok: true,
    cwd,
    folderName: path.basename(cwd),
    parentFolder: path.basename(path.dirname(cwd)),
    isMyCleanErpMainOne: isFolderOne,
    hint: isFolderOne
      ? '맞습니다. my-clean-erp-main (1) 쪽에서 실행 중입니다.'
      : '다른 폴더입니다. Cursor 터미널에서 (1)\\my-clean-erp-main 으로 이동 후 npm run dev 하세요.',
  })
}
