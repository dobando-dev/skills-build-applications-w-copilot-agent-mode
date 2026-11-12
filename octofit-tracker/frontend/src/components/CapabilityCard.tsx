import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type Props = {
  title: string;
  description: string;
  endpoint: string;
  dataKey: string;
  emptyMessage: string;
};

type CapabilityItem = Record<string, unknown>;

function isCapabilityItem(value: unknown): value is CapabilityItem {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function CapabilityCard({ title, description, endpoint, dataKey, emptyMessage }: Props) {
  const [items, setItems] = useState<CapabilityItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getJson<Record<string, unknown>>(endpoint)
      .then((response) => {
        const data = response[dataKey];
        if (!Array.isArray(data) || !data.every(isCapabilityItem)) throw new Error(`Invalid ${dataKey} response`);
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [dataKey, endpoint]);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">{title}</h2>
        <p>{description}</p>
        {error ? <p role="alert">Unable to load {title.toLowerCase()}.</p> : items === null ? (
          <p role="status">Loading {title.toLowerCase()}...</p>
        ) : items.length === 0 ? (
          <p>{emptyMessage}</p>
        ) : (
          <ul className="list-group">
            {items.map((item, index) => (
              <li className="list-group-item" key={index}>
                {Object.entries(item).map(([key, value]) => (
                  <p key={key} className="mb-1">
                    <strong>{key}: </strong>
                    {Array.isArray(value) ? value.join(', ') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
