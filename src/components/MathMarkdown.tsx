import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { markdownComponents } from './Markdown'
import { fileUrlTransform } from '../features/files/FileWorkspace'

/** Chunk aparte: KaTeX solo se descarga si el mensaje trae mates. */
export default function MathMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      urlTransform={fileUrlTransform}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={markdownComponents}
    >
      {children}
    </ReactMarkdown>
  )
}
