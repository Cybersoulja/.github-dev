<?php
/**
 * BeatinDaBlock WordPress Theme — functions.php
 */

// ── Theme Support ─────────────────────────────────────────────────────────────
add_action( 'after_setup_theme', function () {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'html5', [ 'search-form', 'comment-form', 'gallery', 'caption' ] );
    add_theme_support( 'custom-logo', [
        'height'      => 80,
        'width'       => 300,
        'flex-height' => true,
        'flex-width'  => true,
    ] );
    register_nav_menus( [
        'primary' => __( 'Primary Navigation', 'beatindablock' ),
        'footer'  => __( 'Footer Navigation', 'beatindablock' ),
    ] );
} );

// ── Enqueue Styles & Scripts ──────────────────────────────────────────────────
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'beatindablock-style',
        get_stylesheet_uri(),
        [],
        '1.0.0'
    );
    wp_enqueue_style(
        'beatindablock-main',
        get_template_directory_uri() . '/assets/css/style.css',
        [],
        '1.0.0'
    );
    wp_enqueue_script(
        'beatindablock-episodes',
        get_template_directory_uri() . '/assets/js/episodes.js',
        [],
        '1.0.0',
        true
    );
} );

// ── Custom Post Type: Episode ─────────────────────────────────────────────────
add_action( 'init', function () {
    register_post_type( 'episode', [
        'labels' => [
            'name'               => __( 'Episodes', 'beatindablock' ),
            'singular_name'      => __( 'Episode', 'beatindablock' ),
            'add_new_item'       => __( 'Add New Episode', 'beatindablock' ),
            'edit_item'          => __( 'Edit Episode', 'beatindablock' ),
            'view_item'          => __( 'View Episode', 'beatindablock' ),
            'all_items'          => __( 'All Episodes', 'beatindablock' ),
            'search_items'       => __( 'Search Episodes', 'beatindablock' ),
            'not_found'          => __( 'No episodes found.', 'beatindablock' ),
        ],
        'public'            => true,
        'has_archive'       => true,
        'rewrite'           => [ 'slug' => 'episodes' ],
        'menu_icon'         => 'dashicons-microphone',
        'supports'          => [ 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ],
        'show_in_rest'      => true,
    ] );
} );

// ── Custom Taxonomy: Era (archive / new) ──────────────────────────────────────
add_action( 'init', function () {
    register_taxonomy( 'era', 'episode', [
        'labels' => [
            'name'          => __( 'Eras', 'beatindablock' ),
            'singular_name' => __( 'Era', 'beatindablock' ),
        ],
        'hierarchical'  => true,
        'rewrite'       => [ 'slug' => 'era' ],
        'show_in_rest'  => true,
    ] );

    register_taxonomy( 'guest', 'episode', [
        'labels' => [
            'name'          => __( 'Guests', 'beatindablock' ),
            'singular_name' => __( 'Guest', 'beatindablock' ),
        ],
        'hierarchical'  => false,
        'rewrite'       => [ 'slug' => 'guest' ],
        'show_in_rest'  => true,
    ] );
} );

// ── Episode Meta Boxes ────────────────────────────────────────────────────────
add_action( 'add_meta_boxes', function () {
    add_meta_box(
        'episode_details',
        __( 'Episode Details', 'beatindablock' ),
        'beatindablock_episode_meta_box',
        'episode',
        'normal',
        'high'
    );
} );

function beatindablock_episode_meta_box( $post ) {
    wp_nonce_field( 'beatindablock_episode_meta', 'beatindablock_nonce' );
    $audio_url    = get_post_meta( $post->ID, '_episode_audio_url', true );
    $duration     = get_post_meta( $post->ID, '_episode_duration', true );
    $guest        = get_post_meta( $post->ID, '_episode_guest', true );
    $episode_num  = get_post_meta( $post->ID, '_episode_number', true );
    ?>
    <table class="form-table">
        <tr>
            <th><label for="episode_audio_url"><?php esc_html_e( 'Audio URL', 'beatindablock' ); ?></label></th>
            <td><input name="episode_audio_url" id="episode_audio_url" type="url" value="<?php echo esc_attr( $audio_url ); ?>" style="width:100%;" /></td>
        </tr>
        <tr>
            <th><label for="episode_duration"><?php esc_html_e( 'Duration', 'beatindablock' ); ?></label></th>
            <td><input name="episode_duration" id="episode_duration" type="text" value="<?php echo esc_attr( $duration ); ?>" placeholder="HH:MM:SS" /></td>
        </tr>
        <tr>
            <th><label for="episode_guest"><?php esc_html_e( 'Guest(s)', 'beatindablock' ); ?></label></th>
            <td><input name="episode_guest" id="episode_guest" type="text" value="<?php echo esc_attr( $guest ); ?>" style="width:100%;" /></td>
        </tr>
        <tr>
            <th><label for="episode_number"><?php esc_html_e( 'Episode #', 'beatindablock' ); ?></label></th>
            <td><input name="episode_number" id="episode_number" type="number" value="<?php echo esc_attr( $episode_num ); ?>" /></td>
        </tr>
    </table>
    <?php
}

add_action( 'save_post_episode', function ( $post_id ) {
    if ( ! isset( $_POST['beatindablock_nonce'] ) ||
         ! wp_verify_nonce( $_POST['beatindablock_nonce'], 'beatindablock_episode_meta' ) ) {
        return;
    }
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
    if ( ! current_user_can( 'edit_post', $post_id ) ) return;

    if ( isset( $_POST['episode_audio_url'] ) ) {
        update_post_meta( $post_id, '_episode_audio_url', esc_url_raw( wp_unslash( $_POST['episode_audio_url'] ) ) );
    }
    if ( isset( $_POST['episode_duration'] ) ) {
        update_post_meta( $post_id, '_episode_duration', sanitize_text_field( wp_unslash( $_POST['episode_duration'] ) ) );
    }
    if ( isset( $_POST['episode_guest'] ) ) {
        update_post_meta( $post_id, '_episode_guest', sanitize_text_field( wp_unslash( $_POST['episode_guest'] ) ) );
    }
    if ( isset( $_POST['episode_number'] ) ) {
        update_post_meta( $post_id, '_episode_number', absint( wp_unslash( $_POST['episode_number'] ) ) );
    }
} );
