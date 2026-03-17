const port = 5005;

export const apiCallGet = (path) => {
  return fetch(`http://localhost:${port}/${path}`, {
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
