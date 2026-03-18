import { Plugin } from "obsidian";

export default class ExamplePlugin extends Plugin {

	onload() {
		console.log("hello world")
	}
}
