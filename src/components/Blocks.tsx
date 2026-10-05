import type { Block } from '@/content/types';

/** Renderiza bloques estructurados (nunca HTML libre). */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blocks">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return (
              <p key={i}>
                {b.lead ? <span className="lead">{b.lead}</span> : null}
                {b.text}
              </p>
            );
          case 'h':
            return <h4 key={i}>{b.text}</h4>;
          case 'ul':
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            );
          case 'quote':
            return <blockquote key={i}>{b.text}</blockquote>;
          case 'table':
            return (
              <div className="table-scroll" key={i} tabIndex={0} role="region" aria-label={b.caption ?? 'Tabla de datos'}>
                <table>
                  <thead>
                    <tr>
                      {b.headers.map((h, j) => (
                        <th key={j} className={j > 0 ? 'num' : undefined}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} className={k > 0 ? 'num' : undefined}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
