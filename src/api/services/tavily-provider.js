import { HttpError } from '../errors.js';
import { config } from '../config.js';

export const fetchRoleContext = async (role, options = {}) => {
  if (options.forceTimeout) {
    throw new HttpError(504, 'Tavily timeout');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query: `${role} interview topics and expectations`,
      search_depth: 'basic',
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily request failed: ${response.status}`);
  }

  return response.json();
};
