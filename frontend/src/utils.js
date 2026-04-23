const API_URL = 'https://f14a-bravo.onrender.com' || 'http://localhost:5005';

export const apiCallGet = (path) => {
  return fetch(`${API_URL}/${path}`, {
    method: 'GET',
    headers: {
      'Content-type': 'application/json',
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        throw new Error(data.error);
      } else {
        return Promise.resolve(data);
      }
    });
};
