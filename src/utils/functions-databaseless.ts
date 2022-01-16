import { ObjectId } from "mongoose"
import cryptoRandomString from "crypto-random-string"
import IdModel, { IdType } from "../database/ids"
/**
 * Used to set the id of the database items, so it's not a 24-char-long hex ObjectID but is readable
 **/
export async function getUserStringFromID(type: IdType): Promise<{
	id: string,
	_id: ObjectId,
}> {
	let executions = 0
	// The code will eventually create a successfull ID
	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const id = cryptoRandomString({ length: 6, type: "alphanumeric" })
			const record = await IdModel.create({
				id,
				type,
			})
			if (record) {
				return {
					id: id,
					_id: record._id,
				}
			}
		} catch {
			// generated ID was not unique, but this shouldn't happen. just loop again

			// to prevent too many execution loops
			executions++
			if (executions > 100) throw new Error("Could not generate unique ID")
		}
	}
	throw new Error("Was not able to generate a unique ID")
}

// validate IDs that are visible to users, generated by the function above
export function validateUserString(string: unknown): string is string {
	if (!string) return false
	if (typeof string !== "string") return false // it's not a string so it's obviously wrong
	if (string.length !== 7) return false
	return true
}
