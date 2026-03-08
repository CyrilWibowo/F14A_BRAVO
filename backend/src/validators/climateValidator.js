const Ajv = require("ajv")
const ajv = new Ajv()

const climateSchema = require("../models/climateSchema")

const validate = ajv.compile(climateSchema)

function validateClimateData(body) {
  const valid = validate(body)
  if (!valid) {
    return {
      success: false,
      errors: validate.errors
    }
  }
  return { success: true }
}

module.exports = { validateClimateData }