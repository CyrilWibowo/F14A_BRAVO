const climateSchema = {
  type: "object",
  required: ["data_source", "dataset_type", "dataset_id", "time_object", "events"],
  properties: {
    data_source: {
      type: "string",
      enum: ["open_meteo"]  //only accepts Open Meteo as a source
    },
    dataset_type: {
      type: "string",
      enum: ["climate_data"]  //only accepts climate_data as a type
    },
    dataset_id: { type: "string" },
    time_object: {
      type: "object",
      required: ["timestamp", "timezone"],
      properties: {
        timestamp: { type: "string" },
        timezone: { type: "string" }
      }
    },
    events: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["time_object", "event_type", "attribute"],
        properties: {
          time_object: {
            type: "object",
            required: ["timestamp", "duration", "duration_unit", "timezone"],
            properties: {
              timestamp: { type: "string" },
              duration: { type: "number" },
              duration_unit: {
                type: "string",
                enum: ["month", "year"]
              },
              timezone: { type: "string" }
            }
          },
          event_type: {
            type: "string"
          },
          attribute: {
            type: "object",
            required: [
              "mean_temperature",
              "precipitation",
              "relative_humidity",
              "uv_index",
              "windspeed",
              "daylight_duration"
            ],
            properties: {
              mean_temperature: { type: "number" },
              precipitation: { type: "number", minimum: 0 },
              relative_humidity: { type: "number", minimum: 0, maximum: 100 },
              uv_index: { type: "number", minimum: 0 },
              windspeed: { type: "number", minimum: 0 },
              daylight_duration: { type: "number", minimum: 0 }
              // units: {
              //   type: "object",
              //   properties: {
              //     mean_temperature: { type: "string" },
              //     precipitation: { type: "string" },
              //     relative_humidity: { type: "string" },
              //     uv_index: { type: "string" },
              //     windspeed: { type: "string" },
              //     daylight_duration: { type: "string" }
              //   }
              // }
            }
          }
        }
      }
    }
  }
}
