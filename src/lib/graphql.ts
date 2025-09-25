const GRAPHQL_ENDPOINT = 'http://localhost:8686/graphql';

export async function gqlRequest<T>(
  query: string, 
  variables?: Record<string, any>,
  token?: string
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const json = await response.json();
  
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
} 