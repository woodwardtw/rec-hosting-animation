<?php
/**
 * Plugin Name: Reclaim Hosting Animation
 * Description: Enqueues the Reclaim Hosting animation assets on page 46587.
 * Version: 1.1.3
 * Author: Reclaim Hosting
 */

if (!defined('ABSPATH')) {
	exit;
}

//only enqueue assets on the specific page
function rec_hosting_animation_enqueue_assets() {
	if (!is_page(46587)) {
		return;
	}

	$plugin_url = plugin_dir_url(__FILE__);

	wp_enqueue_style(
		'rec-hosting-animation',
		$plugin_url . 'rec-animation-main.css',
		array(),
		'1.1.3'
	);

	wp_enqueue_script(
		'rec-hosting-animation',
		$plugin_url . 'rec-animation-main.js',
		array(),
		'1.1.3',
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);
}
add_action('wp_enqueue_scripts', 'rec_hosting_animation_enqueue_assets');