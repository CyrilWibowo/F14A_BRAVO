import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';

import { InputError, AccessError } from './error';
import { getScore, compareScores, getRanking, getSeasonalScore } from './score';
import { processLocation } from './processing';

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(morgan(':method :url :status'));

const catchErrors = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof InputError) {
      res.status(400).send({ error: err.message });
    } else if (err instanceof AccessError) {
      res.status(403).send({ error: err.message });
    } else {
      console.log(err);
      res.status(500).send({ error: 'A system error occurred' });
    }
  }
};

/***************************************************************
                       Processing
***************************************************************/

app.post(
  '/process',
  catchErrors(async (req, res) => {
    const result = await processLocation(req.body);
    return res.status(200).json(result);
  }),
);

/***************************************************************
                       Scores
***************************************************************/

app.get(
  '/score',
  catchErrors(async (req, res) => {
    const { country_code } = req.query;
    return res.status(200).json(await getScore(country_code));
  }),
);

app.get(
  '/score/compare',
  catchErrors(async (req, res) => {
    const codes = req.query.codes ? req.query.codes.split(',').map((c) => c.trim()) : [];
    return res.status(200).json({ results: await compareScores(codes) });
  }),
);

app.get(
  '/score/ranking',
  catchErrors(async (req, res) => {
    const { min_score, max_score, min_lat, max_lat, min_lon, max_lon } = req.query;
    const bounds =
      min_lat !== undefined
        ? {
            minLat: parseFloat(min_lat),
            maxLat: parseFloat(max_lat),
            minLon: parseFloat(min_lon),
            maxLon: parseFloat(max_lon),
          }
        : undefined;
    return res.status(200).json({
      results: await getRanking(
        min_score !== undefined ? parseFloat(min_score) : undefined,
        max_score !== undefined ? parseFloat(max_score) : undefined,
        bounds,
      ),
    });
  }),
);

app.get(
  '/score/seasonal',
  catchErrors(async (req, res) => {
    const { country_code } = req.query;
    return res.status(200).json(await getSeasonalScore(country_code));
  }),
);

/***************************************************************
                       Running Server
***************************************************************/

const PORT = 5005;

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export default server;
